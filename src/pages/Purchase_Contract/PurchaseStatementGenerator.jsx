import React from "react";
import { useHistory } from "react-router-dom";
import { ArrowLeft, ShoppingCart } from "lucide-react";

export default function PurchaseStatementGenerator() {
    const history = useHistory();

    return (
        <div className="p-6 bg-gray-50 h-full min-h-screen">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <button
                        className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
                        onClick={() => history.goBack()}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-100 rounded-xl">
                            <ShoppingCart size={24} className="text-purple-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Purchase Contract Statements
                            </h1>
                            <p className="text-gray-600">
                                Generate and view statements for your purchase contracts.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content Placeholder */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                    <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShoppingCart size={32} className="text-purple-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        Coming Soon
                    </h2>
                    <p className="text-gray-600 max-w-md mx-auto">
                        The Purchase Contract Statement generator is currently under development.
                        Check back soon for updates!
                    </p>
                </div>
            </div>
        </div>
    );
}
