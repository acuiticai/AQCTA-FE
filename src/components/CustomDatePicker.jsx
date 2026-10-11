"use client";

import { useEffect, useState, useContext } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import moment from "moment";
import { AdminContext } from "@/context/AdminContext";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { useHistory } from "react-router-dom";
import Cookies from "js-cookie";
import { CustomDatePicker as CustomDatePickerComponent } from "@/page-layouts/index";

export default function CustomDatePicker({ ...props }) {
  return <CustomDatePickerComponent {...props} />;
}
