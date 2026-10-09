import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "@/components/ReadAloudText";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { requestDigitalId } from "@/lib/firebase";
import { useDigitalId, useDigitalIdRequest } from "@/hooks/useDigitalID";

/**
 * The Digital ID, laid out like the physical OSCA ID.
 *
 * It is a port of the admin dashboard's card (SCIA_Admin_Firebase ->
 * src/components/Oscaidcard.jsx + Oscaidcard.css), which is what prints on the
 * physical ID: Valenzuela seal / OSCA header / NCSC logo, Name, Address,
 * Date of Birth, Sex, Date Issued, photo, signature line, security seal, red
 * Control No., and the R.A. 9994 benefits on the back. Like the web card it is
 * drawn at a fixed 540x340 and scaled as one unit, so every proportion holds
 * on any screen width. If you change the layout there, change it here too.
 */

interface Props {
  /** Optional. Defaults to the currently signed-in user. */
  uid?: string;
}

const DESIGN_W = 540;
const DESIGN_H = 340; // ID-1 ratio, ~1.586:1

const NAVY = "#1a3a6b";
const NAVY_MID = "#1e4d99";
const GOLD = "#ffd700";
const RED = "#cc1111";
const MONO = Platform.select({ ios: "Courier", default: "monospace" });

const valLogo = require("@/assets/images/vallogo.png");
const ncscLogo = require("@/assets/images/ncsclogo.png");

const BENEFITS = [
  "Free medical / dental, diagnostic & laboratory services in all government facilities",
  "20% discount for medicines",
  "20% discount in hotels, restaurants & recreation centers",
  "20% discount in theaters, cinema houses & concert halls",
  "20% discount in medical / dental services, diagnostic & laboratory fees in private facilities",
  "20% discount in fare for domestic air, sea travel & public land transportations",
  "5% discount in basic necessities & primary commodities",
  "12% VAT-exemption on the purchase of goods & services which are entitled to the 20% discount",
  "5% discount for the monthly utilization of water & electricity, provided that the water & electricity meter bases are under the name of the senior citizens.",
];

// ── formatting (same rules as seniorToCardProps in the admin's DigitalID.jsx) ──
function toDate(value: any): Date | null {
  if (!value) return null;
  const d: Date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Date of Birth as MM-DD-YY. */
function formatDob(dob?: string): string {
  if (!dob) return "";
  const iso = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[2]}-${iso[3]}-${iso[1].slice(2)}`;
  const slash = dob.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return `${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}-${slash[3].slice(2)}`;
  return dob;
}

/** Date Issued as MM-DD-YYYY. */
function formatIssued(value: any): string {
  const d = toDate(value);
  if (!d) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}-${dd}-${d.getFullYear()}`;
}

// ── scaling wrapper: lay out at 540x340, scale to the available width ─────────
function ScaledBox({
  width,
  children,
}: {
  width: number;
  children: React.ReactNode;
}) {
  const scale = width / DESIGN_W;
  const height = DESIGN_H * scale;
  return (
    <View style={{ width, height }}>
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: DESIGN_W,
          height: DESIGN_H,
          transform: [
            { translateX: (width - DESIGN_W) / 2 },
            { translateY: (height - DESIGN_H) / 2 },
            { scale },
          ],
        }}
      >
        {children}
      </View>
    </View>
  );
}

// ── the card itself ───────────────────────────────────────────────────────────
function IdFront({
  name,
  address,
  dob,
  sex,
  issued,
  controlNo,
  photo,
}: {
  name: string;
  address: string;
  dob: string;
  sex: string;
  issued: string;
  controlNo: string;
  photo: { uri: string } | null;
}) {
  return (
    <View style={[f.face]}>
      <View style={f.header}>
        <View style={f.logoBox}>
          <Image source={valLogo} style={f.logo} resizeMode="contain" />
        </View>
        <View style={f.headerCenter}>
          <Text allowFontScaling={false} style={f.republic}>Republic of the Philippines</Text>
          <Text allowFontScaling={false} style={f.city}>CITY OF VALENZUELA</Text>
          <Text allowFontScaling={false} style={f.osca}>Office of the Senior Citizens Affairs (OSCA)</Text>
          <View style={f.digitalBadge}>
            <Text allowFontScaling={false} style={f.digitalBadgeText}>DIGITAL ID</Text>
          </View>
        </View>
        <View style={f.logoBox}>
          <Image source={ncscLogo} style={f.logo} resizeMode="contain" />
        </View>
      </View>

      <View style={f.body}>
        <View style={f.fields}>
          <View style={f.fieldRow}>
            <Text allowFontScaling={false} style={f.fieldLabel}>Name:</Text>
            <Text allowFontScaling={false} style={f.fieldValue}>{name}</Text>
          </View>
          <View style={f.fieldRow}>
            <Text allowFontScaling={false} style={f.fieldLabel}>Address:</Text>
            <Text allowFontScaling={false} style={[f.fieldValue, { fontSize: 10.5 }]}>{address}</Text>
          </View>
          <View style={f.meta}>
            <View style={f.metaBlock}>
              <Text allowFontScaling={false} style={f.metaVal}>{dob}</Text>
              <Text allowFontScaling={false} style={f.metaLbl}>Date of Birth</Text>
            </View>
            <View style={f.metaBlock}>
              <Text allowFontScaling={false} style={f.metaVal}>{sex}</Text>
              <Text allowFontScaling={false} style={f.metaLbl}>Sex</Text>
            </View>
            <View style={f.metaBlock}>
              <Text allowFontScaling={false} style={f.metaVal}>{issued}</Text>
              <Text allowFontScaling={false} style={f.metaLbl}>Date Issued</Text>
            </View>
          </View>
        </View>

        <View style={f.photoBox}>
          {photo ? (
            <Image source={photo} style={f.photoImg} resizeMode="cover" />
          ) : (
            <Ionicons name="person" size={52} color="#bbbbbb" />
          )}
        </View>
      </View>

      <View style={f.bottom}>
        <View style={{ flex: 1 }}>
          <View style={f.sigLine} />
          <Text allowFontScaling={false} style={f.sigLabel}>Signature / Thumbmark</Text>
        </View>
        <View style={f.holo}>
          <Ionicons name="shield-checkmark" size={14} color={NAVY} />
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text allowFontScaling={false} style={f.controlNo}>{controlNo}</Text>
          <Text allowFontScaling={false} style={f.controlLbl}>Control No.</Text>
        </View>
      </View>

      <View style={f.footer}>
        <Text allowFontScaling={false} style={f.footerText}>
          This card is non-transferable  ·  Verify at valid.valenzuela.gov.ph
        </Text>
      </View>
    </View>
  );
}

function IdBack() {
  return (
    <View style={f.face}>
      <View style={[f.stripe, { backgroundColor: NAVY_MID }]} />
      <View style={b.titleBar}>
        <Text allowFontScaling={false} style={b.title}>Benefits and Privileges under R.A. 9994</Text>
      </View>

      <View style={b.body}>
        {BENEFITS.map((text, i) => (
          <View key={i} style={b.itemRow}>
            <Text allowFontScaling={false} style={b.itemNo}>{i + 1}.</Text>
            <Text allowFontScaling={false} style={b.item}>{text}</Text>
          </View>
        ))}
        <View style={b.notice}>
          <Text allowFontScaling={false} style={b.noticeText}>
            Persons and corporations violating R.A. 9994 shall be penalized.
          </Text>
          <Text allowFontScaling={false} style={b.noticeText}>
            Only for the exclusive use of senior citizens; abuse of privileges is punishable by law.
          </Text>
        </View>
        <View style={b.signers}>
          <View style={b.signer}>
            <View style={{ height: 8 }} />
            <View style={b.signerLine} />
            <Text allowFontScaling={false} style={b.signerName}>Dorothy G. Evangelista</Text>
            <Text allowFontScaling={false} style={b.signerTitle}>OSCA Head</Text>
          </View>
          <View style={b.signer}>
            <View style={{ height: 8 }} />
            <View style={b.signerLine} />
            <Text allowFontScaling={false} style={b.signerName}>WES Gatchalian</Text>
            <Text allowFontScaling={false} style={b.signerTitle}>City Mayor</Text>
          </View>
        </View>
      </View>

      <View style={b.footer}>
        <View style={b.footerLeft}>
          <Text allowFontScaling={false} style={b.tuloy}>Tuloy-PROGRESO,</Text>
          <Text allowFontScaling={false} style={b.progresoCity}>Valenzuela!</Text>
        </View>
        <View style={b.footerRight}>
          <Text allowFontScaling={false} style={b.web}>www.valenzuela.gov.ph</Text>
          <Text allowFontScaling={false} style={b.socials}>
            info@valenzuela.gov.ph   f Valenzuela City   @ valenzuelacity
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── screen-facing component ───────────────────────────────────────────────────
export default function DigitalIDCard({ uid }: Props) {
  const { user } = useAuth();
  const { t } = useSettings();
  const { data, loading, error } = useDigitalId(uid);
  const request = useDigitalIdRequest(uid);

  const [width, setWidth] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const flip = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(flip, {
      toValue: flipped ? 1 : 0,
      duration: 450,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [flipped, flip]);

  // Once the request is answered, stop the local spinner.
  useEffect(() => {
    if (request && request.status !== "requested") setClaiming(false);
  }, [request]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.floor(e.nativeEvent.layout.width));

  const handleClaim = async () => {
    setClaimError("");
    setClaiming(true);
    try {
      await requestDigitalId();
      // The card appears by itself when digital_ids/{uid} is created; a
      // refusal arrives as request.status === "denied" with a message.
    } catch (e) {
      console.warn("requestDigitalId failed:", e);
      setClaimError(t("didClaimFail"));
      setClaiming(false);
    }
  };

  const h = width ? (width * DESIGN_H) / DESIGN_W : 0;

  // 1. loading
  if (loading) {
    return (
      <View onLayout={onLayout} style={[s.panel, { backgroundColor: NAVY, height: h || 180 }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  // 2. no digital ID yet -> claim
  if (!data) {
    const verified = user?.isVerified === true;
    const waiting = claiming || request?.status === "requested";
    const denied = !waiting && request?.status === "denied" ? request.message : "";

    return (
      <View onLayout={onLayout} style={[s.panel, s.claimPanel, { minHeight: h || 180 }]}>
        <Ionicons name="card-outline" size={34} color={NAVY} />
        <Text style={s.claimTitle}>{t("didTitle")}</Text>
        <Text style={s.claimSub}>
          {error
            ? t("didLoadError")
            : verified
              ? t("didVerified")
              : t("didNotYet")}
        </Text>

        {!!(denied || claimError) && <Text style={s.claimError}>{denied || claimError}</Text>}

        <TouchableOpacity
          style={[s.claimBtn, (!verified || waiting) && s.claimBtnDisabled]}
          onPress={handleClaim}
          disabled={!verified || waiting || !!error}
          activeOpacity={0.85}
        >
          {waiting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.claimBtnText}>{t("didClaim")}</Text>
          )}
        </TouchableOpacity>
        {waiting && <Text style={s.claimHint}>{t("didCreating")}</Text>}
      </View>
    );
  }

  // 3. the card
  const photoUri =
    data.photoURL ||
    data.photoUrl ||
    data.idImageUrl ||
    (data.idImageBase64 ? `data:image/jpeg;base64,${data.idImageBase64}` : "");
  const invalidated = data.status === "invalidated";
  const frontRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });

  return (
    <View onLayout={onLayout} style={{ width: "100%" }}>
      {invalidated && (
        <View style={s.invalidBanner}>
          <Ionicons name="warning" size={16} color="#B91C1C" />
          <Text style={s.invalidText}>
            {t("didInvalid")}
          </Text>
        </View>
      )}

      {width > 0 && (
        <Pressable onPress={() => setFlipped((v) => !v)} style={invalidated && { opacity: 0.45 }}>
          <ScaledBox width={width}>
            <Animated.View
              style={[s.faceWrap, { transform: [{ perspective: 1200 }, { rotateY: frontRotate }] }]}
            >
              <IdFront
                name={(data.fullName || "UNKNOWN").toUpperCase()}
                address={data.address || "—"}
                dob={formatDob(data.dob) || "—"}
                sex={(data.sex || "—").toUpperCase()}
                issued={formatIssued(data.releasedAt) || "—"}
                controlNo={data.controlNumber || data.idNumber || "——————"}
                photo={photoUri ? { uri: photoUri } : null}
              />
            </Animated.View>
            <Animated.View
              style={[s.faceWrap, { transform: [{ perspective: 1200 }, { rotateY: backRotate }] }]}
            >
              <IdBack />
            </Animated.View>
          </ScaledBox>
        </Pressable>
      )}

      <Text style={s.flipHint}>
        {flipped ? "↩ Tap card to see front" : "↪ Tap card to see benefits (back)"}
      </Text>
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  faceWrap: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backfaceVisibility: "hidden",
  },
  panel: {
    width: "100%",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  claimPanel: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 18,
  },
  claimTitle: { fontSize: 17, fontWeight: "800", color: NAVY, marginTop: 6 },
  claimSub: { fontSize: 13, color: "#4B5563", textAlign: "center", marginTop: 4, marginBottom: 12 },
  claimError: { fontSize: 12, color: "#B91C1C", textAlign: "center", marginBottom: 10 },
  claimBtn: {
    backgroundColor: "#2356E1",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 170,
    alignItems: "center",
  },
  claimBtnDisabled: { backgroundColor: "#9CA3AF" },
  claimBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  claimHint: { fontSize: 12, color: "#6B7280", marginTop: 8 },
  invalidBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  invalidText: { flex: 1, fontSize: 12, color: "#991B1B" },
  flipHint: { fontSize: 11, color: "#6B7280", textAlign: "center", marginTop: 6 },
});

// front face — numbers are the CSS values in Oscaidcard.css
const f = StyleSheet.create({
  face: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "#fff",
    borderRadius: 10,
    overflow: "hidden",
  },
  header: {
    backgroundColor: NAVY_MID,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 72,
    paddingVertical: 6,
  },
  logoBox: { width: 68, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  logo: { width: 52, height: 52 },
  headerCenter: { flex: 1, alignItems: "center", paddingVertical: 4 },
  republic: { color: "#fff", fontSize: 9, letterSpacing: 0.4, marginBottom: 2 },
  city: { color: GOLD, fontSize: 15, fontWeight: "900", letterSpacing: 1.2, marginBottom: 2 },
  osca: { color: "#fff", fontSize: 8, letterSpacing: 0.2 },
  digitalBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderColor: "rgba(255,255,255,0.5)",
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  digitalBadgeText: { color: "#fff", fontSize: 7, fontWeight: "700", letterSpacing: 1, fontStyle: "italic" },

  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  fields: { flex: 1 },
  fieldRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6, gap: 4 },
  fieldLabel: { fontSize: 10, fontWeight: "700", color: "#111", minWidth: 56, paddingTop: 1 },
  fieldValue: { flex: 1, fontSize: 12, fontFamily: MONO, fontWeight: "700", color: "#111", lineHeight: 15 },
  meta: {
    flexDirection: "row",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#ccc",
  },
  metaBlock: { flex: 1, alignItems: "center" },
  metaVal: { fontSize: 11, fontFamily: MONO, fontWeight: "700", color: "#111" },
  metaLbl: { fontSize: 7, color: "#555", marginTop: 2 },
  photoBox: {
    width: 84,
    height: 100,
    borderWidth: 1.5,
    borderColor: "#aaa",
    backgroundColor: "#efefef",
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoImg: { width: "100%", height: "100%" },

  bottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  sigLine: { borderTopWidth: 1, borderTopColor: "#333", width: 140, marginTop: 22, marginBottom: 3 },
  sigLabel: { fontSize: 7.5, color: "#333" },
  // CSS conic-gradient sheen, approximated with four coloured arcs
  holo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderTopColor: "#ff6ec4",
    borderRightColor: "#ffd76e",
    borderBottomColor: "#6ecbff",
    borderLeftColor: "#a16eff",
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },
  controlNo: { fontSize: 20, fontWeight: "700", color: RED, fontFamily: MONO, letterSpacing: 2 },
  controlLbl: { fontSize: 7.5, color: "#333", marginTop: 2 },

  footer: { backgroundColor: NAVY, alignItems: "center", paddingVertical: 4 },
  footerText: { color: "#fff", fontSize: 8, fontStyle: "italic", letterSpacing: 0.3 },
  stripe: { height: 6 },
});

// back face
const b = StyleSheet.create({
  titleBar: {
    backgroundColor: "#fff",
    paddingTop: 8,
    paddingBottom: 5,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  title: { fontSize: 12.5, fontWeight: "900", color: "#111", textAlign: "center" },
  body: { flex: 1, paddingTop: 7, paddingHorizontal: 14, backgroundColor: "#fff", overflow: "hidden" },
  itemRow: { flexDirection: "row", paddingVertical: 1.5 },
  itemNo: { fontSize: 8.5, color: "#111", width: 16 },
  item: { flex: 1, fontSize: 8.5, color: "#111", lineHeight: 11 },
  notice: { marginTop: 5, paddingTop: 4, borderTopWidth: 1, borderTopColor: "#ddd" },
  noticeText: { fontSize: 7.5, color: "#333", fontStyle: "italic", marginVertical: 1.5 },
  signers: { flexDirection: "row", justifyContent: "space-between", paddingTop: 2, paddingHorizontal: 10 },
  signer: { alignItems: "center" },
  signerLine: { borderTopWidth: 1, borderTopColor: "#333", width: 160, marginBottom: 3 },
  signerName: { fontSize: 8.5, fontWeight: "700", color: "#111" },
  signerTitle: { fontSize: 7.5, color: "#555" },
  footer: { flexDirection: "row", alignItems: "stretch" },
  footerLeft: { backgroundColor: RED, paddingVertical: 6, paddingHorizontal: 12, minWidth: 155, justifyContent: "center" },
  tuloy: { color: "#fff", fontSize: 8, fontWeight: "700" },
  progresoCity: { color: GOLD, fontSize: 9.5, fontWeight: "900" },
  footerRight: { flex: 1, backgroundColor: NAVY, paddingVertical: 6, paddingHorizontal: 12, alignItems: "flex-end", justifyContent: "center" },
  web: { color: "#fff", fontSize: 8.5, fontWeight: "700" },
  socials: { color: "rgba(255,255,255,0.8)", fontSize: 7, marginTop: 2 },
});
