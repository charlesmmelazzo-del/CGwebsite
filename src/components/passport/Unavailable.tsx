import { Cover, Notice } from "./ui";

export default function Unavailable() {
  return (
    <Cover title="Back in a moment">
      <Notice>Passport is temporarily unavailable. Please try again in a few minutes.</Notice>
    </Cover>
  );
}
