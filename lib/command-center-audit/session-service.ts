import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface StartSessionInput {
  companyId: string;
  branchId?: string | null;
  userId: string;

  ip?: string;
  browser?: string;
  os?: string;
  device?: string;

  screenWidth?: number;
  screenHeight?: number;

  module?: string;
  page?: string;
  route?: string;
}

export class SessionService {
  async start(data: StartSessionInput) {
    const token = crypto.randomUUID();

    const { data: session, error } = await supabase
      .from("user_sessions")
      .insert({
        company_id: data.companyId,
        branch_id: data.branchId,
        user_id: data.userId,

        session_token: token,

        ip: data.ip,
        browser: data.browser,
        os: data.os,
        device: data.device,

        screen_width: data.screenWidth,
        screen_height: data.screenHeight,

        current_module: data.module,
        current_page: data.page,
        current_route: data.route,

        online: true
      })
      .select()
      .single();

    if (error) throw error;

    return session;
  }

  async heartbeat(
    sessionId: string,
    route: string,
    page: string,
    module: string
  ) {
    await supabase
      .from("user_sessions")
      .update({
        last_activity: new Date().toISOString(),
        current_route: route,
        current_page: page,
        current_module: module,
        online: true
      })
      .eq("id", sessionId);
  }

  async idle(sessionId: string, seconds: number) {
    await supabase
      .from("user_sessions")
      .update({
        idle_seconds: seconds
      })
      .eq("id", sessionId);
  }

  async logout(sessionId: string) {
    await supabase
      .from("user_sessions")
      .update({
        logout_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        online: false
      })
      .eq("id", sessionId);
  }

  async changeScreen(
    sessionId: string,
    companyId: string,
    userId: string,
    module: string,
    page: string,
    route: string
  ) {

    const now = new Date().toISOString();

    const { data: open } = await supabase
      .from("screen_history")
      .select("*")
      .eq("session_id", sessionId)
      .is("left_at", null)
      .maybeSingle();

    if (open) {

      const seconds = Math.floor(
        (Date.now() - new Date(open.entered_at).getTime()) / 1000
      );

      await supabase
        .from("screen_history")
        .update({
          left_at: now,
          seconds
        })
        .eq("id", open.id);
    }

    await supabase
      .from("screen_history")
      .insert({

        session_id: sessionId,

        company_id: companyId,

        user_id: userId,

        module,

        page,

        route,

        entered_at: now

      });

    await this.heartbeat(
      sessionId,
      route,
      page,
      module
    );
  }

  async onlineUsers(companyId: string) {

    const { data } = await supabase
      .from("command_center_online_users")
      .select("*")
      .eq("company_id", companyId)
      .order("last_activity", {
        ascending: false
      });

    return data ?? [];
  }
}

export const sessionService = new SessionService();