import { Cover, TextLink } from "./ui";

/** The end of every sign-up, whoever the email belongs to (so it never reveals who is a member). */
export default function CheckEmail({ email }: { email: string }) {
  return (
    <Cover title="Check your email" subtitle={<>Check your email to finish setting up your Passport. We sent a link to <span className="text-[#EDE6D3]">{email}</span>.</>}
      footer={<>Nothing there after a few minutes? Check your spam folder. <TextLink href="/passport">Back to sign in</TextLink></>}>
      <p className="font-body text-sm text-center leading-relaxed text-[#97A586]">The link works once and expires in 48 hours.</p>
    </Cover>
  );
}
