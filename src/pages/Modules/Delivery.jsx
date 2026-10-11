import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { Button } from "@windmill/react-ui";

const DeliveryTab = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      console.log(data);
      // Add your submission logic here
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sm:container mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid grid-cols-2 gap-6">
          {/* Left Column */}
          <div>
            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">Tip Options</label>
              <input
                {...register("tip_options")}
                className="border rounded-md w-full p-2"
                placeholder="1,2,3,4,5,5"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">Tax Name</label>
              <input
                {...register("tax_name")}
                className="border rounded-md w-full p-2"
                placeholder="SST"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">Host Name</label>
              <input
                {...register("host_name")}
                className="border rounded-md w-full p-2"
                placeholder="https://rest.sandbox.lalamove.com"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">API Secret</label>
              <input
                {...register("api_secret")}
                className="border rounded-md w-full p-2"
                placeholder="sk_test_747gDK4C/I9IUti6oK0y7xN08d0Nf+rq77rx4z/r"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">Open Time</label>
              <input
                {...register("open_time")}
                type="time"
                className="border rounded-md w-full p-2"
                placeholder="12:00 AM"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">Address</label>
              <input
                {...register("address")}
                className="border rounded-md w-full p-2"
                placeholder="1st Floor, 323, Jln Pudu, City Centre, 55100 Kuala Lun"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">Longitude</label>
              <input
                {...register("longitude")}
                className="border rounded-md w-full p-2"
                placeholder="101.712416"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">Delay Grace Time</label>
              <input
                {...register("delay_grace_time")}
                className="border rounded-md w-full p-2"
                placeholder="2"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">Distance for Free Delivery</label>
              <input
                {...register("distance_free_delivery")}
                className="border rounded-md w-full p-2"
                placeholder="1"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">Additional Delivery Fee</label>
              <input
                {...register("additional_delivery_fee")}
                className="border rounded-md w-full p-2"
                placeholder="0"
              />
            </div>
          </div>

          {/* Right Column */}
          <div>
            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">Tax %</label>
              <input
                {...register("tax_percentage")}
                className="border rounded-md w-full p-2"
                placeholder="6"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">DELIVERY VIA</label>
              <input
                {...register("delivery_via")}
                className="border rounded-md w-full p-2"
                placeholder="Lalamove"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">API Key</label>
              <input
                {...register("api_key")}
                className="border rounded-md w-full p-2"
                placeholder="pk_test_4d7401ba6f122857a0e27fe88cb26922"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">Is Biz closed?</label>
              <input
                {...register("is_biz_closed")}
                className="border rounded-md w-full p-2"
                placeholder="No"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">Close Time</label>
              <input
                {...register("close_time")}
                type="time"
                className="border rounded-md w-full p-2"
                placeholder="11:59 PM"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">Latitude</label>
              <input
                {...register("latitude")}
                className="border rounded-md w-full p-2"
                placeholder="3.135178"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">API Tied User</label>
              <input
                {...register("api_tied_user")}
                className="border rounded-md w-full p-2"
                placeholder="+601116516096"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">Preparation Time</label>
              <input
                {...register("preparation_time")}
                className="border rounded-md w-full p-2"
                placeholder="6"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">Order Amount for Free Delivery</label>
              <input
                {...register("order_amount_free_delivery")}
                className="border rounded-md w-full p-2"
                placeholder="600"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 mt-6">
          <Button type="button" layout="outline">
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default DeliveryTab;