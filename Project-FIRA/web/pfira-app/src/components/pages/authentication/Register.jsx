import React, { useState } from 'react';
import { FiUpload, FiCheck, FiChevronDown } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    headquarter: '',
    emergencyExpertise: '',
    headOfficeName: '',
    staffPosition: '',
    email: '',
    address: '',
    postalCode: '',
    directorName: '',
    status: 'pending',
    submittedAt: null,
    documents: {
      idFront: null,
      idBack: null,
      selfie: null,
      proof: null,
      additional: null
    }
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDocumentUpload = (documentType, file) => {
    setFormData(prev => ({
      ...prev,
      documents: {
        ...prev.documents,
        [documentType]: file
      }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setStep(step + 1);
  };

  const handleFinalSubmit = () => {
    // Add timestamp to the registration
    const finalFormData = {
      ...formData,
      submittedAt: new Date().toISOString(),
      id: Date.now() // Generate a unique ID
    };

    // Save to localStorage for demo purposes (in real app, this would be an API call)
    const existingRegistrations = JSON.parse(localStorage.getItem('pendingRegistrations') || '[]');
    existingRegistrations.push(finalFormData);
    localStorage.setItem('pendingRegistrations', JSON.stringify(existingRegistrations));

    // Create admin notification
    const notifications = JSON.parse(localStorage.getItem('adminNotifications') || '[]');
    notifications.push({
      id: Date.now(),
      type: 'new_registration',
      title: 'New Registration Submitted',
      message: `${finalFormData.firstName} ${finalFormData.lastName} has submitted a new registration application.`,
      timestamp: new Date().toISOString(),
      read: false,
      registrationData: finalFormData
    });
    localStorage.setItem('adminNotifications', JSON.stringify(notifications));

    // Move to success step
    setStep(4);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 py-4 px-6">
          <h1 className="text-2xl font-bold text-white">CEBU EMERGENCY RESPONSE OFFICIAL REGISTRATION</h1>
          <p className="text-red-100 mt-1">Success registration platform for emergency response officials in Cebu City</p>
        </div>

        {/* Progress Steps */}
        <div className="flex border-b">
          {[1, 2, 3, 4].map((i) => (
            <div 
              key={i} 
              className={`flex-1 py-4 text-center font-medium ${step >= i ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}
            >
              Step {i}: {i === 1 ? 'Information' : i === 2 ? 'Documents' : i === 3 ? 'Review' : 'Complete'}
            </div>
          ))}
        </div>

        {/* Form Content */}
        <div className="p-6">
          {step === 1 && (
            <form onSubmit={handleSubmit}>
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Personal Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
                    pattern="[0-9]{10,11}"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Official Headquarters</label>
                  <select
                    name="headquarter"
                    value={formData.headquarter}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
                  >
                    <option value="">Select Headquarters</option>
                    <option value="Cebu City Disaster Risk Reduction Office">Cebu City DRRMO</option>
                    <option value="Cebu City Health Department">Cebu City Health</option>
                    <option value="Cebu City Police Office">CCPO</option>
                    <option value="Bureau of Fire Protection Cebu">BFP Cebu</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Expertise</label>
                  <input
                    type="text"
                    name="emergencyExpertise"
                    value={formData.emergencyExpertise}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
                  />
                </div>
              </div>

              <h2 className="text-xl font-semibold mb-4 text-gray-800">Location & Contact</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street/Office Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                  <input
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
                    pattern="[0-9]{4}"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Office Director Name</label>
                  <input
                    type="text"
                    name="directorName"
                    value={formData.directorName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Next: Document Upload
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Document Verification</h2>
              <p className="text-gray-600 mb-6">Please upload the requested documents for validation.</p>
              
              <div className="space-y-6">
                {[
                  { title: "Government ID (front)", desc: "Clear photo of front side of valid government ID", key: "idFront" },
                  { title: "Government ID (back)", desc: "Clear photo of back side of valid government ID", key: "idBack" },
                  { title: "Face Photo / Selfie", desc: "Clear photo matching your government ID", key: "selfie" },
                  { title: "Station/Office Proof", desc: "Proof of your official station/office building", key: "proof" },
                  { title: "Additional Documents", desc: "Service Record, Certificate of Training, etc.", key: "additional" }
                ].map((doc, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-800">{doc.title}</h3>
                        <p className="text-sm text-gray-500">{doc.desc}</p>
                      </div>
                      <div className="flex flex-col items-end">
                        <input
                          type="file"
                          id={`file-${doc.key}`}
                          onChange={(e) => handleDocumentUpload(doc.key, e.target.files[0])}
                          className="hidden"
                          accept="image/*,.pdf"
                        />
                        <label
                          htmlFor={`file-${doc.key}`}
                          className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer"
                        >
                          <FiUpload className="mr-2" />
                          {formData.documents[doc.key] ? 'Uploaded' : 'Upload'}
                        </label>
                        {formData.documents[doc.key] && (
                          <span className="text-xs text-green-600 mt-1">
                            ✓ {formData.documents[doc.key].name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(step + 1)}
                  className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Next: Review Application
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Review Your Application</h2>
              
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <FiCheck className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      Please review your information before submitting
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="font-medium text-gray-800 mb-3">Personal Information</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Name:</span> {formData.firstName} {formData.lastName}</p>
                    <p><span className="font-medium">Mobile:</span> {formData.mobile}</p>
                    <p><span className="font-medium">Email:</span> {formData.email}</p>
                    <p><span className="font-medium">Headquarters:</span> {formData.headquarter}</p>
                    <p><span className="font-medium">Expertise:</span> {formData.emergencyExpertise}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-800 mb-3">Location & Contact</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Address:</span> {formData.address}</p>
                    <p><span className="font-medium">Postal Code:</span> {formData.postalCode}</p>
                    <p><span className="font-medium">Director:</span> {formData.directorName}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between">
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleFinalSubmit}
                  className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Submit Application
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Application Submitted</h2>
              
              <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <FiCheck className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-700">
                      Your application has been submitted successfully!
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-medium text-gray-800 mb-3">What to expect next:</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      Admin will review your documents within 3-5 working days
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      You may receive a verification call from our team
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      Status updates will be sent to your registered email
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      Once approved, you'll receive your official emergency responder ID
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-medium text-gray-800 mb-3">Cebu City Emergency Contacts:</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li>DRRMO: (032) 412-1234</li>
                    <li>Police: 166 / (032) 256-7890</li>
                    <li>Fire: 160 / (032) 256-1234</li>
                    <li>Medical: 161 / (032) 412-4567</li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200 flex justify-center">
                <button
                  onClick={() => navigate('/login')}
                  className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Go to Login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;