import React, { useContext, useState, useEffect } from "react";
import { Link, useHistory } from "react-router-dom";
import { useForm } from "react-hook-form";
import Cookies from "js-cookie";
import { useDispatch } from "react-redux";
import { AdminContext } from "@/context/AdminContext";
import AdminServices from "@/services/AdminServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import { removeSetting } from "@/reduxStore/slice/settingSlice";
import { Button } from "@windmill/react-ui";
import Error from "@/components/form/others/Error";
import LabelArea from "@/components/form/selectOption/LabelArea";
import InputArea from "@/components/form/input/InputArea";
import CMButton from "@/components/form/button/CMButton";
import loginFrame from "@/assets/loginFrame.svg";
import useConfigLogo from "@/hooks/useConfigLogo";
import { AiOutlineMail, AiOutlineLock } from "react-icons/ai";

const Login = () => {
  const dispatchRedux = useDispatch();
  const { dispatch } = useContext(AdminContext);
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = () => {
    setLoading(true);
    dispatchRedux(removeSetting("globalSetting"));
    AdminServices.loginAdmin({ email, password })
      .then((res) => {
        if (res) {
          setLoading(false);
          notifySuccess("Login Success!");
          dispatch({ type: "USER_LOGIN", payload: res });
          history.replace("/");
        }
      })
      .catch((err) => {
        notifyError(err?.response?.data?.message || err?.message);
        setLoading(false);
      });
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

  const overlayContentStyle = {
    padding: "0px",
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

  const forgotPasswordStyle = {
    textAlign: "right",
    fontSize: "14px",
    marginTop: "24px",
  };

  const SignUpStyle = {
    textAlign: "center",
    fontSize: "14px",
    marginTop: "24px",
  };

  const linkStyle = {
    color: "#EF4444",
    textDecoration: "none",
  };

  const SignUpLinkStyle = {
    color: "blue",
    textDecoration: "none",
  };

  const logo = useConfigLogo();

  return (
    <div style={mainContainerStyle}>
      <div style={leftColumnStyle}>
        <img style={frameImageStyle} src={loginFrame} alt="Login Frame" />
        <div style={overlayStyle}>
          <div style={overlayContentStyle}>
            <h1 style={headingStyle}>The</h1>
            <h1 style={headingStyle}>simplest</h1>
            <h1 style={headingStyle}>way to</h1>
            <h1 style={headingStyle}>manage</h1>
            <h1 style={headingStyle}>your work</h1>
            <p
              style={{
                fontSize: "16px",
                color: "#374151",
                marginBottom: "32px",
              }}
            >
              Enter your credentials to access your account.
            </p>
          </div>
        </div>
      </div>
      <div style={rightColumnStyle}>
        <div style={formContainerStyle}>
          <img src={logo} alt="Logo" style={logoStyle} />
          <h2 style={titleStyle}>Get Started Now</h2>
          <p style={subtitleStyle}>Welcome Back</p>
          <form onSubmit={handleSubmit(onSubmit)}>
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
            <Error errorName={errors.email} />

            <div style={{ marginTop: "24px" }}></div>
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
              icon={<AiOutlineLock size={20} color="#9CA3AF" />} // ✅ Password icon
            />
            <Error errorName={errors.password} />
            <p style={forgotPasswordStyle}>
              <Link to="/" style={linkStyle}>
                Forgot Password?
              </Link>
            </p>
            <Button type="submit" style={buttonStyle}>
              Login
            </Button>
          </form>
          <p style={SignUpStyle}>
            Don't Have an Account ?{" "}
            <Link to="/signup" style={SignUpLinkStyle}>
              Create New
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
