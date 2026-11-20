import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

function Login() {
  const navigate = useNavigate();
  const { login, register, user } = useContext(AuthContext);

  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "customer",
  });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (user) {
      navigate(user.role === "customer" ? "/" : "/dashboard");
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    setSubmitting(true);

    try {
      if (mode === "login") {
        const loggedUser = await login({
          email: form.email,
          password: form.password,
        });
        setMsg(`Welcome back, ${loggedUser.name}`);
        navigate(loggedUser.role === "customer" ? "/" : "/dashboard");
      } else {
        const createdUser = await register({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
        });
        setMsg(`Account created for ${createdUser.name}`);
        navigate(createdUser.role === "customer" ? "/" : "/dashboard");
      }
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[80vh] p-4">
      <form
        onSubmit={handleSubmit}
        className={`
          w-96 p-6 rounded-xl shadow-lg space-y-4
          ${isDark ? "bg-gray-700 text-white" : "bg-white text-black"}
        `}
      >
        <div className="flex justify-center gap-2 border-b pb-3">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
              setMsg("");
            }}
            className={`px-4 py-1 rounded text-sm font-semibold ${
              mode === "login"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
              setMsg("");
            }}
            className={`px-4 py-1 rounded text-sm font-semibold ${
              mode === "register"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800"
            }`}
          >
            Register
          </button>
        </div>

        <h2 className="text-2xl font-bold text-center">
          {mode === "login" ? "Login" : "Create Account"}
        </h2>

        {mode === "register" && (
          <input
            type="text"
            placeholder="Full Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={`
              w-full p-2 border rounded
              ${
                isDark
                  ? "bg-gray-600 text-white border-gray-500"
                  : "bg-white text-black border-gray-300"
              }
            `}
          />
        )}

        <input
          type="email"
          placeholder="Email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className={`
            w-full p-2 border rounded
            ${
              isDark
                ? "bg-gray-600 text-white border-gray-500"
                : "bg-white text-black border-gray-300"
            }
          `}
        />

        <input
          type="password"
          placeholder="Password"
          required
          minLength={6}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className={`
            w-full p-2 border rounded
            ${
              isDark
                ? "bg-gray-600 text-white border-gray-500"
                : "bg-white text-black border-gray-300"
            }
          `}
        />

        {mode === "register" && (
          <div>
            <label className="block text-sm font-medium mb-1">Account Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className={`
                w-full p-2 border rounded
                ${
                  isDark
                    ? "bg-gray-600 text-white border-gray-500"
                    : "bg-white text-black border-gray-300"
                }
              `}
            >
              <option value="customer">Customer</option>
              <option value="seller">Seller</option>
            </select>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {submitting
            ? "Please wait..."
            : mode === "login"
              ? "Login"
              : "Register"}
        </button>

        {error && (
          <p className="text-center text-red-500 text-sm font-medium">{error}</p>
        )}

        {msg && (
          <p className="text-center text-green-500 font-semibold">{msg}</p>
        )}
      </form>
    </div>
  );
}

export default Login;