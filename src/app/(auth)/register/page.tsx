import { register } from "../actions";
import { AuthForm } from "../AuthForm";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return <AuthForm mode="register" action={register} requireInvite={!!process.env.INVITE_CODE?.trim()} />;
}
