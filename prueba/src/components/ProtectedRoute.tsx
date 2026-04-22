// ===== COMPONENTE DE RUTA PROTEGIDA =====
// Redirige al login si el usuario no está autenticado
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  // Mostrar loading mientras verifica autenticación
  if (isLoading) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p>Cargando...</p>
      </div>
    );
  }

  // Si no está autenticado, redirigir al login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Si está autenticado, mostrar el contenido
  return <>{children}</>;
}
