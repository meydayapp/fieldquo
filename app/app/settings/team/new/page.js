// app/app/team/new/page.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Upload, User as UserIcon } from "lucide-react";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import { formatPhoneInput } from "@/lib/validation";
import {
  PERMISSION_CATEGORIES,
  PERMISSION_TOGGLES,
  PERMISSION_DERIVED_NOTES,
  PERMISSION_PRESETS,
  PRESET_TO_ROLE,
} from "@/lib/permissions";
import { reportResponseError } from "@/lib/clientErrors";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "uk", label: "Ukrainian" },
  { value: "ru", label: "Russian" },
  { value: "zh", label: "Chinese" },
  { value: "hi", label: "Hindi" },
  { value: "ar", label: "Arabic" },
];

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400";

function emptyPermissionValues() {
  const values = {};
  Object.keys(PERMISSION_CATEGORIES).forEach((key) => {
    values[key] = PERMISSION_CATEGORIES[key].levels[0].value;
  });
  Object.keys(PERMISSION_TOGGLES).forEach((key) => {
    values[key] = false;
  });
  return values;
}

export default function NewUserPage() {
  const router = useRouter();

  const [personal, setPersonal] = useState({
    imageUrl: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    postalCode: "",
    country: "CA",
  });
  const [laborCostPerHour, setLaborCostPerHour] = useState("");

  const [isAdministrator, setIsAdministrator] = useState(false);
  const [activePreset, setActivePreset] = useState(null); // key into PERMISSION_PRESETS, or null = custom
  const [permissionValues, setPermissionValues] = useState(
    emptyPermissionValues(),
  );

  const [emailSubscribed, setEmailSubscribed] = useState(true);
  const [invitationLanguage, setInvitationLanguage] = useState("en");

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function applyPreset(key) {
    setActivePreset(key);
    setIsAdministrator(false);
    setPermissionValues({ ...PERMISSION_PRESETS[key].values });
  }

  function setPermission(key, value) {
    setActivePreset(null); // any manual edit means it's no longer exactly a named preset
    setPermissionValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) setPersonal((p) => ({ ...p, imageUrl: data.url })); else {
        // Was silent: a failed request did nothing visible at all.
        await reportResponseError(res);
      }
    } finally {
      setUploading(false);
    }
  }

  function handlePlaceSelected({
    address,
    city,
    province,
    postalCode,
    country,
  }) {
    setPersonal((p) => ({
      ...p,
      address,
      city: city || p.city,
      province: province || p.province,
      postalCode: postalCode || p.postalCode,
      country: country || p.country,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const role = isAdministrator
      ? "admin"
      : PRESET_TO_ROLE[activePreset] || "employee";

    try {
      const res = await fetch("/api/settings/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: personal.email,
          role,
          name: personal.name,
          phone: personal.phone,
          address: personal.address,
          city: personal.city,
          province: personal.province,
          postalCode: personal.postalCode,
          country: personal.country,
          imageUrl: personal.imageUrl,
          laborCostPerHour: laborCostPerHour ? Number(laborCostPerHour) : null,
          permissions: isAdministrator
            ? { isAdministrator: true }
            : permissionValues,
          invitationLanguage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not invite user");
      router.push("/app/settings/team");
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New User</h1>
        <p className="text-sm text-gray-500 mt-1">
          They'll get an email invite to set up their own login. Everything
          below is saved now and applied automatically once they accept.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal information */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">
            Personal Information
          </h2>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
              {personal.imageUrl ? (
                <img
                  src={personal.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon size={24} className="text-gray-400" />
              )}
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-full px-4 py-2 cursor-pointer hover:bg-gray-50">
              <Upload size={14} />
              {uploading ? "Uploading..." : "Upload image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={uploading}
              />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Full name
              </label>
              <input
                required
                className={inputClass}
                value={personal.name}
                onChange={(e) =>
                  setPersonal({ ...personal, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Email address
              </label>
              <input
                required
                type="email"
                className={inputClass}
                value={personal.email}
                onChange={(e) =>
                  setPersonal({ ...personal, email: e.target.value })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Mobile phone number
              </label>
              <input
                className={inputClass}
                placeholder="555-123-4567"
                value={personal.phone}
                onChange={(e) =>
                  setPersonal({
                    ...personal,
                    phone: formatPhoneInput(e.target.value),
                  })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Street address
              </label>
              <AddressAutocomplete
                value={personal.address}
                onChange={(v) => setPersonal({ ...personal, address: v })}
                onPlaceSelected={handlePlaceSelected}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                City
              </label>
              <input
                className={inputClass}
                value={personal.city}
                onChange={(e) =>
                  setPersonal({ ...personal, city: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Province
              </label>
              <input
                className={inputClass}
                value={personal.province}
                onChange={(e) =>
                  setPersonal({ ...personal, province: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Postal code
              </label>
              <input
                className={inputClass}
                value={personal.postalCode}
                onChange={(e) =>
                  setPersonal({ ...personal, postalCode: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Country
              </label>
              <input
                className={inputClass}
                value={personal.country}
                onChange={(e) =>
                  setPersonal({ ...personal, country: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-1">
              Labour cost
              <Info
                size={13}
                className="text-gray-400"
                title="Their true hourly cost to the business (wage + burden) — used for job costing, not shown to clients."
              />
            </label>
            <div className="relative w-40">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                $
              </span>
              <input
                type="number"
                step="0.01"
                className={`${inputClass} pl-6`}
                placeholder="Employee cost / hr"
                value={laborCostPerHour}
                onChange={(e) => setLaborCostPerHour(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Permissions</h2>

          <label className="flex items-start gap-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg p-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={isAdministrator}
              onChange={(e) => setIsAdministrator(e.target.checked)}
            />
            <span>
              <span className="font-medium text-gray-900">
                Make administrator
              </span>
              <br />
              <span className="text-gray-500">
                This allows them access to everything within the account —
                including billing, reports, client list editing, and all user
                permissions.
              </span>
            </span>
          </label>

          {!isAdministrator && (
            <>
              <div>
                <p className="text-sm text-gray-500 mb-2">
                  Start with a preset permission level, and customize further as
                  needed.
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {Object.entries(PERMISSION_PRESETS).map(([key, preset]) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => applyPreset(key)}
                      className={`text-left p-3 rounded-lg border text-sm ${
                        activePreset === key
                          ? "border-gray-900 bg-gray-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="font-medium text-gray-900">
                        {preset.label}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {preset.description}
                      </div>
                    </button>
                  ))}
                  <div
                    className={`text-left p-3 rounded-lg border text-sm ${
                      activePreset === null
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200 text-gray-400"
                    }`}
                  >
                    <div className="font-medium text-gray-900">Custom</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Set each permission below individually.
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                {Object.entries(PERMISSION_CATEGORIES).map(([key, cat]) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      {cat.label}
                    </label>
                    <select
                      className={inputClass}
                      value={permissionValues[key]}
                      onChange={(e) => setPermission(key, e.target.value)}
                    >
                      {cat.levels.map((lvl) => (
                        <option key={lvl.value} value={lvl.value}>
                          {lvl.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-2 border-t border-gray-100">
                {Object.entries(PERMISSION_TOGGLES).map(
                  ([key, description]) => (
                    <label
                      key={key}
                      className="flex items-start gap-2.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={!!permissionValues[key]}
                        onChange={(e) => setPermission(key, e.target.checked)}
                      />
                      <span>
                        <span className="font-medium text-gray-900 capitalize">
                          {key.replace(/([A-Z])/g, " $1")}
                        </span>
                        <br />
                        <span className="text-gray-500">{description}</span>
                      </span>
                    </label>
                  ),
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-100 text-xs text-gray-400">
                {Object.entries(PERMISSION_DERIVED_NOTES).map(([key, note]) => (
                  <p key={key}>
                    <span className="font-medium capitalize">
                      {key.replace(/([A-Z])/g, " $1")}:
                    </span>{" "}
                    {note}
                  </p>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Communications */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">
            Communications
          </h2>

          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={emailSubscribed}
              onChange={(e) => setEmailSubscribed(e.target.checked)}
            />
            <span>
              <span className="font-medium text-gray-900">
                Email subscriptions
              </span>
              <br />
              <span className="text-gray-500">
                Receive occasional surveys to tell us how we're doing.
              </span>
            </span>
          </label>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Invitation language
            </label>
            <p className="text-xs text-gray-400 mb-1.5">
              The chosen language only applies to the invitation and can't be
              changed once sent.
            </p>
            <select
              className={`${inputClass} max-w-xs`}
              value={invitationLanguage}
              onChange={(e) => setInvitationLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/app/settings/team")}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Sending invite..." : "Send Invite"}
          </button>
        </div>
      </form>
    </div>
  );
}
