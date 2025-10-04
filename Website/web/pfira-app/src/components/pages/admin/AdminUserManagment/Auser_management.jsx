import React, { useState, useEffect } from "react";
import { supabase } from "../../../../config/supabase";
import { FaPlus, FaEdit, FaTrash, FaSpinner } from "react-icons/fa";

export default function UserManagement() {
  const [activeCollection, setActiveCollection] = useState("stationUsers"); // toggle between citizenUsers & stationUsers
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    status: "Active",
  });

  const [message, setMessage] = useState("");

  // normalize schema for stations vs citizens
  const mapDoc = (data) => {
    if (activeCollection === "stationUsers") {
      return {
        id: data.id,
        name: data.station_name || data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        status: data.status || "Active",
        updatedAt: data.updated_at || data.created_at || null,
      };
    } else {
      return {
        id: data.id,
        name: data.first_name && data.last_name ? `${data.first_name} ${data.last_name}` : data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        status: data.status || "Active",
        updatedAt: data.updated_at || data.created_at || null,
      };
    }
  };

  // fetch data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let tableName = activeCollection === "stationUsers" ? "station_users" : "citizens";
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching data:', error);
          setItems([]);
        } else {
          const list = data.map(mapDoc);
          setItems(list);
        }
      } catch (err) {
        console.error('Error:', err);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeCollection]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let tableName = activeCollection === "stationUsers" ? "station_users" : "citizens";
      
      if (isEditing) {
        const updateData = {
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          status: formData.status,
          updated_at: new Date().toISOString(),
        };

        if (activeCollection === "stationUsers") {
          updateData.station_name = formData.name;
        } else {
          const nameParts = formData.name.split(' ');
          updateData.first_name = nameParts[0] || '';
          updateData.last_name = nameParts.slice(1).join(' ') || '';
        }

        const { error } = await supabase
          .from(tableName)
          .update(updateData)
          .eq('id', currentId);

        if (error) throw error;
        setMessage("Updated successfully");
      } else {
        const insertData = {
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          status: formData.status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (activeCollection === "stationUsers") {
          insertData.station_name = formData.name;
        } else {
          const nameParts = formData.name.split(' ');
          insertData.first_name = nameParts[0] || '';
          insertData.last_name = nameParts.slice(1).join(' ') || '';
        }

        const { error } = await supabase
          .from(tableName)
          .insert(insertData);

        if (error) throw error;
        setMessage("Added successfully");
      }
      
      setShowForm(false);
      setFormData({ name: "", email: "", phone: "", address: "", status: "Active" });
      setIsEditing(false);
      setCurrentId(null);
      
      // Refresh the data
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error) {
        const list = data.map(mapDoc);
        setItems(list);
      }
    } catch (err) {
      console.error(err);
      setMessage("Error performing action");
    }
  };

  const handleEdit = (item) => {
    setFormData({
      name: item.name,
      email: item.email,
      phone: item.phone,
      address: item.address,
      status: item.status,
    });
    setIsEditing(true);
    setCurrentId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      let tableName = activeCollection === "stationUsers" ? "station_users" : "citizens";
      
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setMessage("Deleted successfully");
      
      // Refresh the data
      const { data, error: fetchError } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!fetchError) {
        const list = data.map(mapDoc);
        setItems(list);
      }
    } catch (err) {
      console.error(err);
      setMessage("Error deleting");
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">User Management (Admin)</h1>

      {/* Switch between collections */}
      <div className="mb-4 flex gap-2">
        <button
          className={`px-3 py-1 rounded ${
            activeCollection === "stationUsers" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
          onClick={() => setActiveCollection("stationUsers")}
        >
          Stations
        </button>
        <button
          className={`px-3 py-1 rounded ${
            activeCollection === "citizenUsers" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
          onClick={() => setActiveCollection("citizenUsers")}
        >
          Citizens
        </button>
      </div>

      {/* Action bar */}
      <div className="flex justify-between mb-3">
        <button
          onClick={() => setShowForm(true)}
          className="bg-green-600 text-white px-3 py-1 rounded flex items-center gap-2"
        >
          <FaPlus /> Add {activeCollection === "stationUsers" ? "Station" : "Citizen"}
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center p-4"><FaSpinner className="animate-spin text-xl" /></div>
      ) : (
        <table className="w-full border">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">Name</th>
              <th className="border px-2 py-1">Email</th>
              <th className="border px-2 py-1">Phone</th>
              <th className="border px-2 py-1">Address</th>
              <th className="border px-2 py-1">Status</th>
              <th className="border px-2 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="border px-2 py-1">{item.name}</td>
                <td className="border px-2 py-1">{item.email}</td>
                <td className="border px-2 py-1">{item.phone}</td>
                <td className="border px-2 py-1">{item.address}</td>
                <td className="border px-2 py-1">{item.status}</td>
                <td className="border px-2 py-1 flex gap-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="bg-yellow-500 text-white px-2 py-1 rounded"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="bg-red-600 text-white px-2 py-1 rounded"
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded w-96">
            <h2 className="font-bold mb-2">
              {isEditing ? "Edit" : "Add"} {activeCollection === "stationUsers" ? "Station" : "Citizen"}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <input
                name="name"
                placeholder="Name"
                value={formData.name}
                onChange={handleChange}
                className="border p-1"
              />
              <input
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                className="border p-1"
              />
              <input
                name="phone"
                placeholder="Phone"
                value={formData.phone}
                onChange={handleChange}
                className="border p-1"
              />
              <input
                name="address"
                placeholder="Address"
                value={formData.address}
                onChange={handleChange}
                className="border p-1"
              />
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="border p-1"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1 bg-gray-300 rounded">
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {message && <div className="mt-3 text-center text-sm text-green-600">{message}</div>}
    </div>
  );
}
