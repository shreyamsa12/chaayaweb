import React, { useState } from 'react';
import { HiPencil, HiTrash, HiSearch, HiX, HiCheck } from 'react-icons/hi';

export default function Tables() {
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [tableData, setTableData] = useState([
        {
            id: 1,
            name: "John Michael",
            email: "john@creative-tim.com",
            role: "Manager",
            status: "Online",
            employed: "23/04/18"
        },
        {
            id: 2,
            name: "Alexa Liras",
            email: "alexa@creative-tim.com",
            role: "Developer",
            status: "Offline",
            employed: "11/01/19"
        },
        // Add more initial data
    ]);

    const [editForm, setEditForm] = useState({});

    const handleEdit = (item) => {
        setEditingId(item.id);
        setEditForm(item);
    };

    const handleSave = () => {
        setTableData(tableData.map(item =>
            item.id === editingId ? editForm : item
        ));
        setEditingId(null);
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this member?')) {
            setTableData(tableData.filter(item => item.id !== id));
        }
    };

    const handleAdd = () => {
        const newMember = {
            id: tableData.length + 1,
            name: "New Member",
            email: "new@example.com",
            role: "Member",
            status: "Offline",
            employed: new Date().toLocaleDateString()
        };
        setTableData([...tableData, newMember]);
        handleEdit(newMember);
    };

    return (
        <div className="container-fluid py-4">
            <div className="card">
                <div className="card-header pb-0 p-3">
                    <div className="d-flex justify-content-between align-items-center">
                        <h6 className="mb-0">Team Members</h6>
                        <div className="d-flex align-items-center">
                            <div className="input-group me-3">
                                <span className="input-group-text text-body">
                                    <HiSearch className="text-dark" />
                                </span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={handleAdd}>
                                Add Member
                            </button>
                        </div>
                    </div>
                </div>
                <div className="card-body px-0 pt-0 pb-2">
                    <div className="table-responsive p-0">
                        <table className="table align-items-center mb-0">
                            <thead>
                                <tr>
                                    <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Author</th>
                                    <th className="text-uppercase text-secondary text-xxs font-weight-bolder opacity-7 ps-2">Role</th>
                                    <th className="text-center text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Status</th>
                                    <th className="text-center text-uppercase text-secondary text-xxs font-weight-bolder opacity-7">Employed</th>
                                    <th className="text-secondary opacity-7">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableData
                                    .filter(item =>
                                        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        item.email.toLowerCase().includes(searchTerm.toLowerCase())
                                    )
                                    .map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <div className="d-flex px-2 py-1">
                                                    <div className="d-flex flex-column justify-content-center">
                                                        {editingId === item.id ? (
                                                            <div>
                                                                <input
                                                                    type="text"
                                                                    className="form-control form-control-sm mb-1"
                                                                    value={editForm.name}
                                                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                                />
                                                                <input
                                                                    type="email"
                                                                    className="form-control form-control-sm"
                                                                    value={editForm.email}
                                                                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <h6 className="mb-0 text-sm">{item.name}</h6>
                                                                <p className="text-xs text-secondary mb-0">{item.email}</p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                {editingId === item.id ? (
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        value={editForm.role}
                                                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                                    />
                                                ) : (
                                                    <p className="text-xs font-weight-bold mb-0">{item.role}</p>
                                                )}
                                            </td>
                                            <td className="align-middle text-center text-sm">
                                                {editingId === item.id ? (
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={editForm.status}
                                                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                                    >
                                                        <option value="Online">Online</option>
                                                        <option value="Offline">Offline</option>
                                                    </select>
                                                ) : (
                                                    <span className={`badge badge-sm bg-gradient-${item.status === 'Online' ? 'success' : 'secondary'}`}>
                                                        {item.status}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="align-middle text-center">
                                                <span className="text-secondary text-xs font-weight-bold">{item.employed}</span>
                                            </td>
                                            <td className="align-middle">
                                                {editingId === item.id ? (
                                                    <>
                                                        <button className="btn btn-link text-success mb-0 me-2" onClick={handleSave}>
                                                            <HiCheck className="text-xs" />
                                                        </button>
                                                        <button className="btn btn-link text-danger mb-0" onClick={() => setEditingId(null)}>
                                                            <HiX className="text-xs" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button className="btn btn-link text-secondary mb-0 me-2" onClick={() => handleEdit(item)}>
                                                            <HiPencil className="text-xs" />
                                                        </button>
                                                        <button className="btn btn-link text-danger mb-0" onClick={() => handleDelete(item.id)}>
                                                            <HiTrash className="text-xs" />
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
} 