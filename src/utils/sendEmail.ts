import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (to: string, subject: string, text: string) => {
  //  const transporter = nodemailer.createTransport({
  //    service: "gmail",
  //    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  //  });

  //  await transporter.sendMail({
  //    from: `"Your App" <${process.env.EMAIL_USER}>`,
  //    to,
  //    subject,
  //    text,
  //  });

  await resend.emails.send({
    from: "reypjbaliguat@gmail.com",
    to,
    subject,
    html: text,
  });
};
