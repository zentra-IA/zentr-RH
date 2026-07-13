import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/server-company";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase não configurado.");
  }

  return createClient(url, key);
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

async function assertCompanyUser(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("company_users")
    .select("id,user_id,name,email,role,active")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Usuário não pertence à empresa atual.");

  return data;
}

function directKey(userA: string, userB: string) {
  return [userA, userB].sort().join(":");
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { companyId, userId } = await requireCompany(req);

    if (!userId) {
      return NextResponse.json(
        { error: "Usuário não identificado. Faça login novamente." },
        { status: 401 }
      );
    }

    const currentUser = await assertCompanyUser(supabase, companyId, userId);
    const { searchParams } = new URL(req.url);
    const conversationId = clean(searchParams.get("conversationId"));

    if (conversationId) {
      const { data: participant, error: participantError } = await supabase
        .from("rh_chat_participants")
        .select("id")
        .eq("company_id", companyId)
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();

      if (participantError) throw new Error(participantError.message);
      if (!participant) {
        return NextResponse.json(
          { error: "Acesso negado à conversa." },
          { status: 403 }
        );
      }

      const { data: messages, error } = await supabase
        .from("rh_chat_messages")
        .select("*")
        .eq("company_id", companyId)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(500);

      if (error) throw new Error(error.message);

      await supabase
        .from("rh_chat_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("company_id", companyId)
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);

      return NextResponse.json({
        success: true,
        currentUser,
        messages: messages || [],
      });
    }

    const { data: participations, error: participationError } = await supabase
      .from("rh_chat_participants")
      .select("conversation_id,last_read_at")
      .eq("company_id", companyId)
      .eq("user_id", userId);

    if (participationError) throw new Error(participationError.message);

    const conversationIds = (participations || []).map(
      (item) => item.conversation_id
    );

    if (!conversationIds.length) {
      return NextResponse.json({
        success: true,
        currentUser,
        conversations: [],
      });
    }

    const { data: conversations, error: conversationError } = await supabase
      .from("rh_chat_conversations")
      .select("*")
      .eq("company_id", companyId)
      .in("id", conversationIds)
      .order("updated_at", { ascending: false });

    if (conversationError) throw new Error(conversationError.message);

    const { data: participants, error: participantsError } = await supabase
      .from("rh_chat_participants")
      .select("*")
      .eq("company_id", companyId)
      .in("conversation_id", conversationIds);

    if (participantsError) throw new Error(participantsError.message);

    const { data: recentMessages, error: messagesError } = await supabase
      .from("rh_chat_messages")
      .select("*")
      .eq("company_id", companyId)
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (messagesError) throw new Error(messagesError.message);

    const response = (conversations || []).map((conversation) => {
      const members = (participants || []).filter(
        (participant) => participant.conversation_id === conversation.id
      );
      const other = members.find(
        (participant) => participant.user_id !== userId
      );
      const ownParticipation = (participations || []).find(
        (participant) => participant.conversation_id === conversation.id
      );
      const messages = (recentMessages || []).filter(
        (message) => message.conversation_id === conversation.id
      );
      const lastMessage = messages[0] || null;
      const lastReadAt = ownParticipation?.last_read_at
        ? new Date(ownParticipation.last_read_at).getTime()
        : 0;
      const unreadCount = messages.filter(
        (message) =>
          message.sender_id !== userId &&
          new Date(message.created_at).getTime() > lastReadAt
      ).length;

      return {
        ...conversation,
        otherUser: other || null,
        lastMessage,
        unreadCount,
      };
    });

    return NextResponse.json({
      success: true,
      currentUser,
      conversations: response,
    });
  } catch (error: any) {
    console.error("GET /api/rh/chat:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao carregar chat." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { companyId, userId } = await requireCompany(req);

    if (!userId) {
      return NextResponse.json(
        { error: "Usuário não identificado. Faça login novamente." },
        { status: 401 }
      );
    }

    const currentUser = await assertCompanyUser(supabase, companyId, userId);
    const body = await req.json();
    const action = clean(body.action);

    if (action === "open_direct") {
      const targetUserId = clean(body.targetUserId);

      if (!targetUserId || userId === targetUserId) {
        return NextResponse.json(
          { error: "Usuário inválido para conversa direta." },
          { status: 400 }
        );
      }

      const targetUser = await assertCompanyUser(
        supabase,
        companyId,
        targetUserId
      );
      const key = directKey(userId, targetUserId);

      const { data: existing, error: existingError } = await supabase
        .from("rh_chat_conversations")
        .select("*")
        .eq("company_id", companyId)
        .eq("direct_key", key)
        .maybeSingle();

      if (existingError) throw new Error(existingError.message);

      if (existing) {
        return NextResponse.json({
          success: true,
          conversation: existing,
          targetUser,
        });
      }

      const { data: conversation, error: createError } = await supabase
        .from("rh_chat_conversations")
        .insert({
          company_id: companyId,
          type: "direct",
          direct_key: key,
          created_by: userId,
        })
        .select()
        .single();

      if (createError) {
        if (createError.code === "23505") {
          const { data: racedConversation, error: raceError } = await supabase
            .from("rh_chat_conversations")
            .select("*")
            .eq("company_id", companyId)
            .eq("direct_key", key)
            .single();

          if (raceError) throw new Error(raceError.message);

          return NextResponse.json({
            success: true,
            conversation: racedConversation,
            targetUser,
          });
        }

        throw new Error(createError.message);
      }

      const { error: participantsError } = await supabase
        .from("rh_chat_participants")
        .insert([
          {
            conversation_id: conversation.id,
            company_id: companyId,
            user_id: userId,
            user_name:
              currentUser.name || currentUser.email || "Usuário",
            last_read_at: new Date().toISOString(),
          },
          {
            conversation_id: conversation.id,
            company_id: companyId,
            user_id: targetUserId,
            user_name:
              targetUser.name || targetUser.email || "Usuário",
          },
        ]);

      if (participantsError) throw new Error(participantsError.message);

      return NextResponse.json({
        success: true,
        conversation,
        targetUser,
      });
    }

    if (action === "send_message") {
      const conversationId = clean(body.conversationId);
      const message = clean(body.message);

      if (!conversationId || !message) {
        return NextResponse.json(
          { error: "Conversa e mensagem são obrigatórias." },
          { status: 400 }
        );
      }

      const { data: participant, error: participantError } = await supabase
        .from("rh_chat_participants")
        .select("id")
        .eq("company_id", companyId)
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();

      if (participantError) throw new Error(participantError.message);
      if (!participant) {
        return NextResponse.json(
          { error: "Acesso negado à conversa." },
          { status: 403 }
        );
      }

      const { data: createdMessage, error } = await supabase
        .from("rh_chat_messages")
        .insert({
          conversation_id: conversationId,
          company_id: companyId,
          sender_id: userId,
          sender_name:
            currentUser.name || currentUser.email || "Usuário",
          body: message,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      await supabase
        .from("rh_chat_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("company_id", companyId)
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);

      return NextResponse.json({
        success: true,
        message: createdMessage,
      });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/rh/chat:", error);
    return NextResponse.json(
      { error: error?.message || "Erro no chat." },
      { status: 500 }
    );
  }
}
