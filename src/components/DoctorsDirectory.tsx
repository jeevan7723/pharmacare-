import React, { useState, useEffect, useRef } from 'react';
import { UserCheck, Plus, Search, Stethoscope, Phone, Building, X, Trash2, Edit2, LogOut } from 'lucide-react';
import { db } from '../db/db';
import { Doctor } from '../types';
import { syncDoctorToCloud, deleteDoctorFromCloud } from '../firebase/firestoreService';

interface DoctorsDirectoryProps {
  onExit?: () => void;
}

export const DoctorsDirectory: React.FC<DoctorsDirectoryProps> = ({ onExit }) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docForm, setDocForm] = useState<Partial<Doctor>>({
    name: '',
    specialization: '',
    clinic: '',
    regNo: '',
    phone: '',
    address: '',
  });

  const dialogRef = useRef<HTMLDialogElement>(null);

  const loadData = async () => {
    const list = await db.doctors.toArray();
    setDoctors(list);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredDoctors = doctors.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.specialization && d.specialization.toLowerCase().includes(search.toLowerCase())) ||
      (d.regNo && d.regNo.toLowerCase().includes(search.toLowerCase()))
  );

  const openAddModal = () => {
    setEditingDocId(null);
    setDocForm({ name: 'Dr. ', specialization: '', clinic: '', regNo: '', phone: '', address: '' });
    setIsModalOpen(true);
    dialogRef.current?.showModal();
  };

  const openEditModal = (d: Doctor) => {
    setEditingDocId(d.id);
    setDocForm(d);
    setIsModalOpen(true);
    dialogRef.current?.showModal();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    dialogRef.current?.close();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.name) {
      alert('Please enter Doctor Name.');
      return;
    }

    if (editingDocId) {
      await db.doctors.update(editingDocId, docForm);
      const updated = await db.doctors.get(editingDocId);
      if (updated) syncDoctorToCloud(updated);
    } else {
      const newDoc: Doctor = {
        ...(docForm as Doctor),
        id: `doc-${Date.now()}`,
      };
      await db.doctors.put(newDoc);
      syncDoctorToCloud(newDoc);
    }

    closeModal();
    await loadData();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name} from doctors directory?`)) return;
    await db.doctors.delete(id);
    deleteDoctorFromCloud(id);
    await loadData();
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-600" />
            Doctors & Prescribers Directory
          </h2>
          <p className="text-xs text-slate-500">
            Maintain local doctors, clinics, and medical registration numbers for printing on prescription invoices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
              title="Exit Doctors Directory"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              <span>Exit</span>
            </button>
          )}

          <button
            onClick={openAddModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Doctor</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search doctor, specialization, Reg No..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      {/* Doctor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDoctors.map((doc) => (
          <div
            key={doc.id}
            className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-emerald-500 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 font-bold">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => openEditModal(doc)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id, doc.name)}
                    className="p-1 text-red-400 hover:text-red-600 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-slate-900 text-base mt-2">{doc.name}</h3>
              {doc.specialization && (
                <p className="text-xs text-emerald-700 font-medium">{doc.specialization}</p>
              )}
              {doc.regNo && (
                <div className="mt-1">
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                    Reg: {doc.regNo}
                  </span>
                </div>
              )}

              <div className="mt-3 space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2">
                {doc.clinic && (
                  <div className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{doc.clinic}</span>
                  </div>
                )}
                {doc.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono">{doc.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <dialog
        ref={dialogRef}
        aria-labelledby="doc-modal-title"
        closedby="any"
        className="rounded-2xl p-0 backdrop:bg-slate-900/60 shadow-2xl max-w-md w-full text-slate-900 overflow-hidden border border-slate-200"
      >
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <h2 id="doc-modal-title" className="text-base font-bold">
            {editingDocId ? 'Edit Doctor' : 'Add New Doctor'}
          </h2>
          <button onClick={closeModal} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Doctor Name *</label>
            <input
              type="text"
              required
              autoFocus
              value={docForm.name || ''}
              onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
              placeholder="Dr. Rajesh Gupta"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Specialization / Degree</label>
            <input
              type="text"
              value={docForm.specialization || ''}
              onChange={(e) => setDocForm({ ...docForm, specialization: e.target.value })}
              placeholder="MBBS, MD (Medicine), Pediatrician"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Medical Council Reg No</label>
            <input
              type="text"
              value={docForm.regNo || ''}
              onChange={(e) => setDocForm({ ...docForm, regNo: e.target.value })}
              placeholder="MCI-1998-12345"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Clinic / Hospital Name</label>
            <input
              type="text"
              value={docForm.clinic || ''}
              onChange={(e) => setDocForm({ ...docForm, clinic: e.target.value })}
              placeholder="Apex Polyclinic"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
            <input
              type="tel"
              value={docForm.phone || ''}
              onChange={(e) => setDocForm({ ...docForm, phone: e.target.value })}
              placeholder="10 digit phone"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
            />
          </div>

          <div className="bg-slate-100 -mx-6 -mb-6 p-4 flex justify-end space-x-2 border-t border-slate-200 mt-6">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md"
            >
              Save Doctor
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
};
