declare module "*/lib/mail/send.mjs" {
  export function sendMail(msg: {
    to: string;
    subject: string;
    text: string;
    replyTo?: string;
  }): Promise<{ sent: boolean; reason?: string; detail?: string }>;
  export function renewalMessage(args: {
    token: string;
    expires: Date | string;
    planName: string;
  }): { subject: string; text: string };
}
