import { login } from "../actions";
import { AuthForm } from "../AuthForm";

export default function LoginPage() {
  return <AuthForm mode="login" action={login} />;
}
