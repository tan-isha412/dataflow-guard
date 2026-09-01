import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";

export function RegisterPage() {
  const [form, setForm] = useState({ email: "", password: "", fullName: "", organizationName: "" });
  const [error, setError] = useState(null);
  const { register } = useAuth();
  const navigate = useNavigate();

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error?.message ?? "Registration failed");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Create an account</h1>
      {error && <p role="alert">{error}</p>}
      <input name="fullName" placeholder="Full name" value={form.fullName} onChange={handleChange} required />
      <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
      <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} required />
      <input name="organizationName" placeholder="Organization name" value={form.organizationName} onChange={handleChange} required />
      <button type="submit">Register</button>
      <p>Already have an account? <Link to="/login">Log in</Link></p>
    </form>
  );
}