import { Resend } from "resend";

export const sendEmail = async (to: string, subject: string, text: string) => {
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const data = await resend.emails.send({
      from: "onboarding@resend.dev", // default test sender
      to,
      subject,
      html: `<p>${text}</p>`,
    });
    return data;
  } catch (error) {
    console.error("Email error:", error);
    throw error;
  }
};
