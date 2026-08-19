// app/app/team/new/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Info, Upload, User as UserIcon } from "lucide-react";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import SeatUpgradePanel from "@/app/components/SeatUpgradePanel";
import { formatPhoneInput } from "@/lib/validation";
import {
  PERMISSION_CATEGORIES,
  PERMISSION_TOGGLES,
  PERMISSION_DERIVED_NOTES,
  PERMISSION_PRESETS,
  PRESET_TO_ROLE,
} from "@/lib/permissions";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";

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
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

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

// ── Hidden, not read-only ──────────────────────────────────────────────────
//
// Hiring. There is nothing to read here — the page is a blank invite form and a
// permission grid for a person who doesn't exist yet — so read-only would be an
// empty screen with a banner on it. The gate is "user:manage", the same one
// POST /api/settings/members enforces, so this refuses exactly the people the
// server would have refused after they filled the whole form in.
//
// Supervisors keep it: they hold "user:manage", and roleManagement.js already
// clamps what they can hand out to strictly below themselves.
export default function NewUserPage() {
  const access = useSettingsAccess();
  if (!access.canSee("user:manage")) return <NoAccessPanel capability="user:manage" />;
  return <NewUserForm />;
}

function NewUserForm() {
  const { t } = useTranslation();
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
  // "We created the invitation but couldn't email it" — a different outcome
  // from a failed save, and it needs a different sentence.
  const [emailWarning, setEmailWarning] = useState("");

  // Seat usage, so a company that's already out of licenses sees the upgrade
  // panel before filling in the whole form — not only after the invite bounces.
  // Same source the Team page reads.
  const [seats, setSeats] = useState({ used: 0, limit: null });
  const [seatLimited, setSeatLimited] = useState(false);
  // Buying licences is owner/admin only — a supervisor pressing Upgrade would
  // just collect a 403, so they don't get the panel (see the Team page).
  const [canBuySeats, setCanBuySeats] = useState(false);

  useEffect(() => {
    fetch("/api/settings/members/self/role")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCanBuySeats(["owner", "admin"].includes(d?.yourRole)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/settings/members/pending")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.seats) return;
        setSeats(data.seats);
        if (data.seats.limit && data.seats.used >= data.seats.limit) {
          setSeatLimited(true);
        }
      })
      .catch(() => {
        // Non-fatal — the seat panel is an early warning; the POST still
        // enforces the real limit server-side.
      });
  }, []);

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
      // fetchJson, not fetch + res.json(). This is the exact call site that
      // produced "The string did not match the expected pattern": the route
      // threw, Next returned HTML, and res.json() surfaced the browser's parser
      // error instead of the reason. See lib/fetchJson.js.
      const result = await fetchJson("/api/settings/members", {
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

      // The invitation row exists either way, but if the email didn't leave,
      // the invitee is waiting for something that will never arrive. Say so
      // here instead of redirecting to a page that shows a cheerful "Invited"
      // badge. The button label was "Send invite" — it has to be true.
      if (result?.emailSent === false) {
        setEmailWarning(
          result.emailError || "The invitation email could not be sent.",
        );
        setSaving(false);
        return;
      }

      router.push("/app/settings/team");
    } catch (err) {
      // A seat-limit 402 comes back structured (see app/api/settings/members
      // route). Reveal the in-place upgrade panel and point the error at it,
      // rather than leaving the contractor with just a red sentence.
      if (err.data?.code === "seat_limit") {
        setSeatLimited(true);
        setSeats({
          used: err.data.used ?? seats.used,
          limit: err.data.limit ?? seats.limit,
        });
      }
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.setTeamNew.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setTeamNew.subtitle")}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
          {/* Only link to the panel when it's actually rendered — a supervisor
              can't buy licences, so an anchor to a missing panel would be a
              link that does nothing. */}
          {seatLimited && canBuySeats && (
            <>
              {" "}
              <a
                href="#seat-upgrade"
                className="font-semibold underline underline-offset-2"
              >
                {t("app.setTeam.addLicensesLink")}
              </a>
            </>
          )}
        </div>
      )}

      {emailWarning && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-sm rounded-lg px-4 py-3 space-y-2">
          <p className="font-semibold">
            {personal.name || "They"} was added, but the invitation email
            didn&apos;t send
          </p>
          <p>{emailWarning}</p>
          <p>
            Nothing reached them. Cancel the pending invite on the{" "}
            <a
              href="/app/settings/team"
              className="font-semibold underline underline-offset-2"
            >
              Team page
            </a>{" "}
            and try again once email is working.
          </p>
        </div>
      )}

      {seatLimited && seats.limit && canBuySeats && (
        <SeatUpgradePanel used={seats.used} limit={seats.limit} />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal information */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            {t("app.setTeamNew.personalInfo")}
          </h2>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
              {personal.imageUrl ? (
                <img
                  src={personal.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon size={24} className="text-muted-foreground" />
              )}
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground border border-border rounded-full px-4 py-2 cursor-pointer hover:bg-muted">
              <Upload size={14} />
              {uploading
                ? t("app.setTeamNew.uploading")
                : t("app.setTeamNew.uploadImage")}
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
              <label className="text-sm font-medium text-foreground block mb-1">
                {t("app.setTeamNew.fullName")}
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
              <label className="text-sm font-medium text-foreground block mb-1">
                {t("app.setTeamNew.emailAddress")}
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
              <label className="text-sm font-medium text-foreground block mb-1">
                {t("app.setTeamNew.mobilePhone")}
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
              <label className="text-sm font-medium text-foreground block mb-1">
                {t("app.setTeamNew.streetAddress")}
              </label>
              <AddressAutocomplete
                value={personal.address}
                onChange={(v) => setPersonal({ ...personal, address: v })}
                onPlaceSelected={handlePlaceSelected}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">
                {t("app.field.city")}
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
              <label className="text-sm font-medium text-foreground block mb-1">
                {t("app.field.province")}
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
              <label className="text-sm font-medium text-foreground block mb-1">
                {t("app.setTeamNew.postalCode")}
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
              <label className="text-sm font-medium text-foreground block mb-1">
                {t("app.setTeamNew.country")}
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
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5 mb-1">
              {t("app.setTeamNew.labourCost")}
              <Info
                size={13}
                className="text-muted-foreground"
                title={t("app.setTeamNew.labourCostHint")}
              />
            </label>
            <div className="relative w-40">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <input
                type="number"
                step="0.01"
                className={`${inputClass} pl-6`}
                placeholder={t("app.setTeamNew.labourCostPlaceholder")}
                value={laborCostPerHour}
                onChange={(e) => setLaborCostPerHour(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            {t("app.setTeamNew.permissions")}
          </h2>

          <label className="flex items-start gap-2.5 text-sm bg-muted border border-border rounded-lg p-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={isAdministrator}
              onChange={(e) => setIsAdministrator(e.target.checked)}
            />
            <span>
              <span className="font-medium text-foreground">
                {t("app.setTeamNew.makeAdmin")}
              </span>
              <br />
              <span className="text-muted-foreground">
                {t("app.setTeamNew.makeAdminDesc")}
              </span>
            </span>
          </label>

          {!isAdministrator && (
            <>
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {t("app.setTeamNew.presetIntro")}
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {Object.entries(PERMISSION_PRESETS).map(([key, preset]) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => applyPreset(key)}
                      className={`text-left p-3 rounded-lg border text-sm ${
                        activePreset === key
                          ? "border-inverted bg-muted"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium text-foreground">
                        {preset.label}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {preset.description}
                      </div>
                    </button>
                  ))}
                  <div
                    className={`text-left p-3 rounded-lg border text-sm ${
                      activePreset === null
                        ? "border-inverted bg-muted"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <div className="font-medium text-foreground">
                      {t("app.setTeamNew.custom")}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t("app.setTeamNew.customDesc")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                {Object.entries(PERMISSION_CATEGORIES).map(([key, cat]) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-foreground block mb-1">
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

              <div className="space-y-3 pt-2 border-t border-border">
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
                        <span className="font-medium text-foreground capitalize">
                          {key.replace(/([A-Z])/g, " $1")}
                        </span>
                        <br />
                        <span className="text-muted-foreground">{description}</span>
                      </span>
                    </label>
                  ),
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-border text-xs text-muted-foreground">
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
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            {t("app.setTeamNew.communications")}
          </h2>

          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={emailSubscribed}
              onChange={(e) => setEmailSubscribed(e.target.checked)}
            />
            <span>
              <span className="font-medium text-foreground">
                {t("app.setTeamNew.emailSubs")}
              </span>
              <br />
              <span className="text-muted-foreground">
                {t("app.setTeamNew.emailSubsDesc")}
              </span>
            </span>
          </label>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.setTeamNew.invitationLanguage")}
            </label>
            <p className="text-xs text-muted-foreground mb-1.5">
              {t("app.setTeamNew.invitationLangHint")}
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
            className="flex-1 border border-border text-foreground py-2.5 rounded-lg text-sm font-semibold"
          >
            {t("app.action.cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            {saving
              ? t("app.setTeamNew.sendingInvite")
              : t("app.setTeamNew.sendInvite")}
          </button>
        </div>
      </form>
    </div>
  );
}
