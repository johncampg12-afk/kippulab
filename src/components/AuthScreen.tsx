import React, { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, getAdditionalUserInfo } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Layers, CheckCircle2, Lock, ArrowRight, Loader2 } from "lucide-react";

interface AuthScreenProps { }

export default function AuthScreen({ }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const details = getAdditionalUserInfo(result);
      if (details?.isNewUser) {
        await setDoc(doc(db, `users/${result.user.uid}/emitter/default`), {
          userId: result.user.uid,
          ruc: "1790000000001",
          name: result.user.displayName || "Mi Empresa S.A.",
          tradeName: result.user.displayName || "Mi Empresa",
          address: "Av. Principal",
          obligado: false,
          environment: "1", 
          serial: "001001",
          updatedAt: new Date()
        });
      }
    } catch (err: any) {
      console.error("Google Auth error:", err);
      let msg = err.message;
      if (msg.includes("popup-closed-by-user")) msg = "Inicio de sesión con Google cancelado.";
      setError(msg || "Error al iniciar sesión con Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Create an initial Emitter document with default schema for the user
        await setDoc(doc(db, `users/${userCredential.user.uid}/emitter/default`), {
          userId: userCredential.user.uid,
          ruc: "1790000000001",
          name: name || "Mi Empresa S.A.",
          tradeName: name || "Mi Empresa",
          address: "Av. Principal",
          obligado: false,
          environment: "1", // Pruebas
          serial: "001001",
          updatedAt: new Date()
        });
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      // Clean up firebase error message
      let msg = err.message;
      if (msg.includes("invalid-credential")) msg = "Credenciales incorrectas.";
      if (msg.includes("email-already-in-use")) msg = "Este correo ya está registrado.";
      if (msg.includes("weak-password")) msg = "La contraseña debe tener al menos 6 caracteres.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-default flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center flex-row items-center gap-3">
          <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center text-[var(--bg-default)] transform -rotate-3 transition-transform hover:rotate-0">
            <Layers className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-display font-bold tracking-tight text-content">
            KippuLab
          </h2>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-content">
          {isLogin ? "Inicia sesión en tu cuenta" : "Crea tu cuenta empresarial"}
        </h2>
        <p className="mt-2 text-center text-sm text-content-secondary">
          El Facturador Electrónico N°1 de Ecuador.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-paper py-8 px-4 shadow sm:rounded-[14px] sm:px-10 border border-divider">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-content mb-1">
                  Nombre de la Empresa / Propietario
                </label>
                <div className="mt-1 relative">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="appearance-none block w-full px-3 py-2.5 border border-divider rounded-[10px] bg-default text-content placeholder-content-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-all"
                    placeholder="Ej. Café Balandra"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-content mb-1">
                Correo Electrónico
              </label>
              <div className="mt-1 relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2.5 border border-divider rounded-[10px] bg-default text-content placeholder-content-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-all"
                  placeholder="correo@empresa.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-content mb-1">
                Contraseña
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2.5 border border-divider rounded-[10px] bg-default text-content placeholder-content-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-[10px] bg-red-50 p-4 border border-red-200">
                <div className="flex">
                  <div className="ml-3 text-sm text-red-700">
                    {error}
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-[10px] shadow-sm text-sm font-medium text-[var(--bg-default)] bg-primary hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70 transition-all items-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isLogin ? "Ingresar al Sistema" : "Comenzar a Facturar"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-divider" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-paper text-content-secondary">O continuar con</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGoogleSignIn}
                type="button"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-divider rounded-[10px] shadow-sm bg-default text-sm font-medium text-content hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all items-center gap-3 disabled:opacity-70"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </button>
            </div>
          </div>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-divider" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-paper text-content-secondary">
                  {isLogin ? "¿No tienes cuenta?" : "¿Ya eres cliente?"}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => { setIsLogin(!isLogin); setError(null); }}
                className="w-full flex justify-center py-2.5 px-4 border border-divider rounded-[10px] shadow-sm bg-default text-sm font-medium text-content hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all items-center"
              >
                {isLogin ? "Regístrate ahora" : "Inicia sesión"}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-12 sm:mx-auto sm:w-full sm:max-w-md text-center text-xs text-content-secondary flex flex-col gap-2 items-center">
         <span className="flex items-center gap-1.5 font-medium"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Autorizado por el SRI</span>
         <span className="flex items-center gap-1.5 font-medium"><Lock className="h-3.5 w-3.5" /> Encriptación Bank-Grade P12</span>
      </div>
    </div>
  );
}
