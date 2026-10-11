import React, { useState, useRef } from 'react';
import { FiUpload, FiX, FiImage, FiStar } from 'react-icons/fi';
import axios from 'axios';
import { notifyError, notifySuccess } from '@/utils/toast';

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const ItemImageUpload = ({ images = [], onImagesChange, featuredImage = "", onFeaturedImageChange, maxImages = 10 }) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (files) => {
    const fileArray = Array.from(files);
    
    // Validate file types (only images)
    const validFiles = fileArray.filter(file => {
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
      const acceptedTypes = ['.jpg', '.jpeg', '.png', '.webp'];
      
      if (!acceptedTypes.includes(fileExtension)) {
        notifyError(`File ${file.name} is not a valid image. Accepted: JPG, PNG, WEBP`);
        return false;
      }
      
      // Max 5MB per image
      if (file.size > 5 * 1024 * 1024) {
        notifyError(`File ${file.name} is too large. Maximum size: 5MB`);
        return false;
      }
      
      return true;
    });

    // Check total images limit
    if (images.length + validFiles.length > maxImages) {
      notifyError(`Maximum ${maxImages} images allowed. You can upload ${maxImages - images.length} more.`);
      return;
    }

    if (validFiles.length > 0) {
      uploadFiles(validFiles);
    }
  };

  const uploadFiles = async (files) => {
    setUploading(true);

    try {
      const uploadedUrls = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);

        try {
          const response = await axios.post(`${Base_URL}/upload`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          if (response.data && response.data.url) {
            uploadedUrls.push(response.data.url);
          } else {
            notifyError(`Failed to upload ${file.name}`);
          }
        } catch (uploadError) {
          console.error('Error uploading file:', uploadError);
          notifyError(`Failed to upload ${file.name}: ${uploadError.response?.data?.message || uploadError.message}`);
        }
      }

      if (uploadedUrls.length > 0) {
        const newImages = [...images, ...uploadedUrls];
        onImagesChange(newImages);
        notifySuccess(`${uploadedUrls.length} image(s) uploaded successfully!`);
      }
    } catch (error) {
      console.error('Error in upload process:', error);
      notifyError('Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const removeImage = (index) => {
    const imageToRemove = images[index];
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
    
    // If the removed image was the featured image, clear the featured image
    if (featuredImage === imageToRemove && onFeaturedImageChange) {
      onFeaturedImageChange("");
    }
    
    notifySuccess('Image removed');
  };

  const setFeaturedImage = (imageUrl) => {
    if (onFeaturedImageChange) {
      onFeaturedImageChange(imageUrl);
      notifySuccess('Featured image set');
    }
  };

  return (
    <div className="w-full">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="text-gray-600">Uploading images...</p>
            </>
          ) : (
            <>
              <FiUpload className={`text-3xl ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} />
              <div className="text-gray-600">
                <p className="font-medium">
                  {dragOver ? 'Drop images here' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  JPG, PNG, WEBP (Max: 5MB each, {maxImages} images total)
                </p>
                {images.length > 0 && (
                  <p className="text-xs text-blue-600 mt-1">
                    {images.length} / {maxImages} images uploaded
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map((imageUrl, index) => (
              <div key={index} className="relative group">
                <div className={`aspect-square rounded-lg overflow-hidden border-2 bg-gray-100 ${
                  featuredImage === imageUrl 
                    ? 'border-yellow-400 border-4' 
                    : 'border-gray-200'
                }`}>
                  <img
                    src={imageUrl}
                    alt={`Item image ${index + 1}`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" dy="10.5" font-weight="bold" x="50%" y="50%" text-anchor="middle"%3EImage%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 z-10"
                  title="Remove image"
                >
                  <FiX className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFeaturedImage(imageUrl);
                  }}
                  className={`absolute top-1 left-1 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10 ${
                    featuredImage === imageUrl
                      ? 'bg-yellow-400 text-yellow-900 opacity-100'
                      : 'bg-gray-800 text-white hover:bg-gray-700'
                  }`}
                  title={featuredImage === imageUrl ? "Featured image" : "Set as featured image"}
                >
                  <FiStar className={`w-4 h-4 ${featuredImage === imageUrl ? 'fill-current' : ''}`} />
                </button>
                <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  {featuredImage === imageUrl ? '⭐ Featured' : `Image ${index + 1}`}
                </div>
              </div>
            ))}
          </div>
          {featuredImage && (
            <div className="mt-2 text-sm text-gray-600 flex items-center gap-2">
              <FiStar className="text-yellow-500 fill-current" />
              <span>Featured image selected</span>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && !uploading && (
        <div className="mt-4 text-center text-gray-500 text-sm">
          <FiImage className="mx-auto text-4xl mb-2 text-gray-300" />
          <p>No images uploaded yet</p>
        </div>
      )}
    </div>
  );
};

export default ItemImageUpload;
