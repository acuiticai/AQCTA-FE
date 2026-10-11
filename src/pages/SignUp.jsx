import React, { useState, useEffect } from "react";
import { Link, useHistory, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Button } from "@windmill/react-ui";
import Error from "@/components/form/others/Error";
import LabelArea from "@/components/form/selectOption/LabelArea";
import InputArea from "@/components/form/input/InputArea";
import signupFrame from "@/assets/loginFrame.svg";
import useConfigLogo from "@/hooks/useConfigLogo";
import { AiOutlineMail, AiOutlineLock, AiOutlineUser } from "react-icons/ai";
import { notifyError, notifySuccess } from "@/utils/toast";
import { useTranslation } from "react-i18next";
import axios from "axios";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const SignUp = () => {
  const history = useHistory();
  const { user_type, business_id } = useParams();  // ✅ Extract URL params

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const { t } = useTranslation();

  const { register, handleSubmit, } = useForm();
  const [errors, setErrors] = useState({ name: "", email: "", password: "" });

  const validateForm = () => {
    let isValid = true;
    const newErrors = { name: "", email: "", imageUrl: "", business_id: '', password: '' };

    if (!name) {
      newErrors.name = t("Name is required.");
      isValid = false;
    }

    if (!password) {
      newErrors.password = t("Password is required.");
      isValid = false;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      newErrors.email = t("Please enter a valid email address.");
      isValid = false;
    }



    setErrors(newErrors);
    return isValid;
  };

  const onSubmit = async () => {
    // e.preventDefault();
    if (!validateForm()) {
      return;
    }
    setLoading(true);

    const CustomerData = { name, email, image: '', password, business_id, user_type: user_type };
    try {
      const url = `${Base_URL}/Customer/SignUp`;
      const method ="post";
      let res = await axios[method](url, CustomerData);
      console.log("res", res)
      if (res.data.status) {
        setLoading(false);
        notifySuccess(res.data.message);
        history.push(`/user_login/${user_type}`)
      } else {
        setLoading(false);
        notifyError(res.data.message);
      }
    } catch (err) {
      setLoading(false);
      console.error("Error submitting Customer:", err);
    }
  };

  const mainContainerStyle = {
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    minHeight: "100vh",
  };

  const leftColumnStyle = {
    display: isMobile ? "none" : "flex",
    width: isMobile ? "100%" : "50%",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  };

  const frameImageStyle = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    padding: "25px",
  };

  const overlayStyle = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    padding: "65px 64px",
  };

  const headingStyle = {
    fontSize: "3.75rem",
    color: "#1F2937",
    lineHeight: "1.25",
  };

  const rightColumnStyle = {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: "48px",
    width: isMobile ? "100%" : "50%",
  };

  const formContainerStyle = {
    width: "100%",
    border: "1px solid #F5F5F5",
    padding: "20px",
    borderRadius: "20px",
    maxWidth: "35rem",
  };

  const logoStyle = {
    height: "56px",
    marginBottom: "32px",
  };

  const titleStyle = {
    fontSize: "30px",
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: "12px",
  };

  const subtitleStyle = {
    fontSize: "16px",
    color: "#4B5563",
    marginBottom: "32px",
  };

  const buttonStyle = {
    marginTop: "32px",
    width: "100%",
    height: "48px",
    borderRadius: "15px",
    backgroundColor: "#84CC16",
    color: "white",
    fontSize: "18px",
    fontWeight: "600",
  };

  const loginLinkStyle = {
    textAlign: "center",
    fontSize: "14px",
    marginTop: "24px",
  };

  const linkStyle = {
    color: "blue",
    textDecoration: "none",
  };

  const logo = useConfigLogo();

  return (
    <div style={mainContainerStyle}>
      {/* Left Side Image */}
      <div style={leftColumnStyle}>
        <img style={frameImageStyle} src={signupFrame} alt="Signup Frame" />
        <div style={overlayStyle}>
          <div>
            <h1 style={headingStyle}>The</h1>
            <h1 style={headingStyle}>simplest</h1>
            <h1 style={headingStyle}>way to</h1>
            <h1 style={headingStyle}>manage</h1>
            <h1 style={headingStyle}>your work</h1>
            <p style={{ fontSize: "16px", color: "#374151", marginBottom: "32px" }}>
              Sign up now to get started!
            </p>
          </div>
        </div>
      </div>

      {/* Right Side Form */}
      <div style={rightColumnStyle}>
        <div style={formContainerStyle}>
          <img src={logo} alt="Logo" style={logoStyle} />
          <h2 style={titleStyle}>Create Your Account</h2>
          {/* <p style={subtitleStyle}>Business ID: {business_id}</p> */}

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Name Field */}
            <LabelArea color="#929296" label="Name" />
            <InputArea
              required
              register={register}
              label="Name"
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter Your Name"
              icon={<AiOutlineUser size={20} color="#9CA3AF" />}
            />
            {errors.name && (
              <span className="text-red-500 text-xs">{errors.name}</span>
            )}

            {/* Email Field */}
            <div style={{ marginTop: '10px' }}></div>
            <LabelArea color="#929296" label="Email" />
            <InputArea
              required
              register={register}
              label="Email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter Email"
              icon={<AiOutlineMail size={20} color="#9CA3AF" />}
            />
            {errors.email && (
              <span className="text-red-500 text-xs">{errors.email}</span>
            )}

            {/* Password Field */}
            <div style={{ marginTop: '10px' }}></div>
            <LabelArea color="#929296" label="Password" />
            <InputArea
              required
              register={register}
              label="Password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Password"
              icon={<AiOutlineLock size={20} color="#9CA3AF" />}
            />
            {errors.password && (
              <span className="text-red-500 text-xs">{errors.password}</span>
            )}

            {/* Submit Button */}
            <Button type="submit" style={buttonStyle}>
              {loading ? "Creating Account..." : "Sign Up"}
            </Button>
          </form>

          {/* Already Have Account */}
          <p style={loginLinkStyle}>
            Already have an account?{" "}
            <Link to="/login" style={linkStyle}>
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
