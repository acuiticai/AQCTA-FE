import requests from "./httpService";

const getItemGradesByBusinessId = async (businessId) => {
  return requests.get(`items/custom/grade/${businessId}`);
};

const getItemGrades = async () => {
  return requests.post(`items/custom/grade/getAll`);
};

const getAllItems = async () => {
  return requests.get(`/items`);
};

const getItemsByBusiness = async (businessId) => {
  return requests.get(`/items?businessId=${businessId}`);
};

const ItemsServices = {
  getItemGradesByBusinessId,
  getItemGrades,
  getAllItems,
  getItemsByBusiness,
};

export default ItemsServices;
