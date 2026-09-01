/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image is not a DOM image and has no alt prop. */

import {
  Document,
  Font,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import {
  compactPdfPreviewText,
  type TrajectoryPdfData,
  type TrajectoryPdfResource,
} from "./trajectory-pdf-data";

const ACCENT = "#0b68ff";
const TEXT = "#151517";
const MUTED = "#5b6067";
const LINE = "#bfc3c8";
const A4 = { width: 595.28, height: 841.89 } as const;
const KEEP_TOGETHER_TEXT_LIMIT = 900;
let registeredFontSource: string | null = null;

function registerPdfAssets(fontSrc: string) {
  if (registeredFontSource === fontSrc) return;
  Font.register({
    family: "Golos Text PDF",
    fonts: [
      { src: fontSrc, fontWeight: 400 },
      { src: fontSrc, fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registeredFontSource = fontSrc;
}

export interface TrajectoryPdfAssets {
  fontSrc: string;
  logoSrc: string;
}

const styles = StyleSheet.create({
  page: {
    width: A4.width,
    height: A4.height,
    minHeight: A4.height,
    paddingTop: 34,
    paddingRight: 42,
    paddingBottom: 44,
    paddingLeft: 42,
    backgroundColor: "#ffffff",
    color: TEXT,
    fontFamily: "Golos Text PDF",
    fontSize: 9.6,
  },
  pageBody: { flexGrow: 1 },
  header: {
    height: 38,
    marginBottom: 24,
    paddingBottom: 10,
    borderBottomWidth: 0.8,
    borderBottomColor: TEXT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBrand: { flexDirection: "row", alignItems: "center" },
  logo: { width: 68, height: 27, objectFit: "contain" },
  brandDivider: { width: 1, height: 20, marginHorizontal: 10, backgroundColor: LINE },
  brandName: { fontSize: 8.8, fontWeight: 700, color: "#383b40" },
  headerMeta: { fontSize: 7.5, fontWeight: 700, letterSpacing: 0.6, color: MUTED },
  footer: {
    position: "absolute",
    left: 42,
    right: 42,
    bottom: 16,
    paddingTop: 7,
    borderTopWidth: 0.7,
    borderTopColor: LINE,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.3,
    color: MUTED,
  },
  eyebrow: {
    marginBottom: 8,
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 0.85,
    color: ACCENT,
  },
  mainHeading: { fontSize: 31, lineHeight: 1.02, fontWeight: 700, letterSpacing: -0.65 },
  moduleHeading: { marginTop: 14, fontSize: 27, lineHeight: 1.05, fontWeight: 700 },
  goal: { marginTop: 12, maxWidth: 460, fontSize: 11.2, lineHeight: 1.48, color: "#3f4247" },
  sectionHeading: { fontSize: 16, lineHeight: 1.15, fontWeight: 700, letterSpacing: -0.2 },
  sectionSubtitle: { marginTop: 6, fontSize: 9.8, color: MUTED },
  currentCard: {
    marginTop: 24,
    borderTopWidth: 0.8,
    borderTopColor: ACCENT,
    borderBottomWidth: 0.8,
    borderBottomColor: LINE,
    paddingVertical: 12,
  },
  currentText: { marginTop: 5, fontSize: 11.4, lineHeight: 1.42 },
  prioritiesBlock: { marginTop: 20 },
  pills: { marginTop: 9, flexDirection: "row", flexWrap: "wrap" },
  pill: {
    marginRight: 12,
    marginBottom: 5,
    borderTopWidth: 0.7,
    borderTopColor: LINE,
    paddingVertical: 5,
    paddingHorizontal: 0,
    fontSize: 8.8,
    color: "#34363a",
  },
  routePreview: {
    marginTop: 20,
    borderTopWidth: 0.8,
    borderTopColor: TEXT,
    borderBottomWidth: 0.8,
    borderBottomColor: LINE,
    paddingVertical: 13,
  },
  previewRow: { flexDirection: "row", alignItems: "flex-start", minHeight: 31 },
  previewRail: { width: 26, alignItems: "center" },
  previewDot: { width: 8, height: 8, marginTop: 3, borderRadius: 4, backgroundColor: ACCENT },
  previewLine: { width: 1, height: 22, backgroundColor: "#b7cef6" },
  previewIndex: { width: 24, fontSize: 8.6, fontWeight: 700, color: ACCENT },
  previewText: { flexGrow: 1, fontSize: 9.2, lineHeight: 1.32 },
  previewFinish: { marginTop: 2, fontSize: 8.5, fontWeight: 700, color: MUTED },
  stepCard: {
    marginBottom: 14,
  },
  stepDividerTop: { height: 0.8, backgroundColor: TEXT },
  stepDividerBottom: { height: 0.8, backgroundColor: LINE },
  stepBody: { position: "relative", paddingTop: 14, paddingBottom: 14, paddingLeft: 37 },
  stepNumber: {
    position: "absolute",
    top: 14,
    left: 0,
    width: 31,
    fontSize: 20,
    lineHeight: 1,
    fontWeight: 700,
    color: ACCENT,
  },
  stepContent: { paddingRight: 2 },
  stepLabel: { marginBottom: 4, fontSize: 8, fontWeight: 700, letterSpacing: 0.9, color: MUTED },
  stepText: { fontSize: 10.4, lineHeight: 1.48, fontWeight: 400 },
  supportSection: { marginTop: 1 },
  supportGrid: { marginTop: 10, flexDirection: "row", gap: 9 },
  supportCard: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 76,
    borderTopWidth: 0.8,
    borderTopColor: TEXT,
    borderBottomWidth: 0.8,
    borderBottomColor: LINE,
    paddingVertical: 10,
  },
  supportCardEmpty: { minHeight: 58 },
  supportName: { fontSize: 10.2, fontWeight: 700, color: "#35383d" },
  supportGoal: { marginTop: 4, fontSize: 8.2, lineHeight: 1.35, color: MUTED },
  resourcesSection: { marginTop: 16 },
  resourceList: {
    marginTop: 9,
    borderTopWidth: 0.8,
    borderTopColor: LINE,
  },
  resourceCard: {
    minHeight: 79,
    marginBottom: 7,
    borderBottomWidth: 0.8,
    borderBottomColor: LINE,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  resourceCopy: { flexGrow: 1, flexBasis: 0, paddingRight: 10 },
  resourceCopyFull: { paddingRight: 0 },
  resourceType: { fontSize: 7.2, fontWeight: 700, letterSpacing: 0.8, color: ACCENT },
  resourceTitle: { marginTop: 3, fontSize: 10, fontWeight: 700, color: TEXT },
  resourceDescription: { marginTop: 3, fontSize: 7.8, lineHeight: 1.3, color: MUTED },
  resourceLink: { textDecoration: "none", color: TEXT },
  qr: { width: 68, height: 68, objectFit: "contain" },
  noResources: {
    marginTop: 9,
    borderTopWidth: 0.8,
    borderTopColor: LINE,
    borderBottomWidth: 0.8,
    borderBottomColor: LINE,
    paddingVertical: 12,
    lineHeight: 1.35,
    color: MUTED,
  },
  paceCard: {
    marginTop: 14,
    borderTopWidth: 0.8,
    borderTopColor: TEXT,
    paddingTop: 11,
    paddingBottom: 11,
  },
  paceLabel: { marginTop: 7, fontSize: 12, fontWeight: 700 },
  paceText: { marginTop: 4, fontSize: 8.2, lineHeight: 1.35, color: MUTED },
  checkpointCard: {
    borderRadius: 0,
    padding: 12,
    backgroundColor: ACCENT,
    color: "#ffffff",
  },
  checkpointEyebrow: { fontSize: 8.1, fontWeight: 700, letterSpacing: 1, color: "#d8e8ff" },
  checkpointHeading: { marginTop: 5, fontSize: 15, fontWeight: 700 },
  checkpointText: { marginTop: 7, fontSize: 9.2, lineHeight: 1.38, color: "#ffffff" },
  finalKeepTogether: { marginTop: 12 },
  disclaimer: { marginTop: 12, fontSize: 7.8, lineHeight: 1.35, color: MUTED },
});

function Header({ logoSrc }: { logoSrc: string }) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.headerBrand}>
        <Image src={logoSrc} style={styles.logo} />
        <View style={styles.brandDivider} />
        <Text style={styles.brandName}>Центр карьеры</Text>
      </View>
      <Text style={styles.headerMeta}>Карьерная траектория</Text>
    </View>
  );
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>Центр карьеры ИТМО</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function PreviewRoute({ steps }: { steps: [string, string, string] }) {
  return (
    <View style={styles.routePreview}>
      <Text style={styles.eyebrow}>МАРШРУТ НА БЛИЖАЙШЕЕ ВРЕМЯ</Text>
      <View style={styles.previewRow}>
        <View style={styles.previewRail}><View style={styles.previewDot} /><View style={styles.previewLine} /></View>
        <Text style={styles.previewIndex}>A</Text>
        <Text style={styles.previewText}>Сейчас</Text>
      </View>
      {steps.map((step, index) => (
        <View style={styles.previewRow} key={`${index}-${step}`}>
          <View style={styles.previewRail}><View style={styles.previewDot} />{index < 2 ? <View style={styles.previewLine} /> : null}</View>
          <Text style={styles.previewIndex}>{String(index + 1).padStart(2, "0")}</Text>
          <Text style={styles.previewText}>{compactPdfPreviewText(step)}</Text>
        </View>
      ))}
      <Text style={styles.previewFinish}>Через 2–4 недели</Text>
    </View>
  );
}

function StepCard({ index, step }: { index: number; step: string }) {
  const canSplitAcrossPages = step.length > KEEP_TOGETHER_TEXT_LIMIT;
  return (
    <View style={styles.stepCard} wrap={canSplitAcrossPages}>
      <View style={styles.stepDividerTop} />
      <View style={styles.stepBody}>
        <Text style={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</Text>
        <View style={styles.stepContent}>
          <Text style={styles.stepLabel}>ШАГ {index + 1}</Text>
          <Text style={styles.stepText} orphans={3} widows={3}>{step}</Text>
        </View>
      </View>
      <View style={styles.stepDividerBottom} />
    </View>
  );
}

function ResourceCard({ resource }: { resource: TrajectoryPdfResource }) {
  const card = (
    <View style={styles.resourceCard} wrap={false}>
      <View style={[styles.resourceCopy, resource.qrDataUrl ? undefined : styles.resourceCopyFull]}>
        <Text style={styles.resourceType}>ПОЛЕЗНЫЙ РЕСУРС</Text>
        <Text style={styles.resourceTitle}>{resource.title}</Text>
        <Text style={styles.resourceDescription}>{resource.description}</Text>
      </View>
      {resource.qrDataUrl ? <Image src={resource.qrDataUrl} style={styles.qr} /> : null}
    </View>
  );
  return resource.href ? (
    <Link src={resource.href} style={styles.resourceLink}>{card}</Link>
  ) : card;
}

export function TrajectoryPdfDocument({
  assets,
  data,
}: {
  assets: TrajectoryPdfAssets;
  data: TrajectoryPdfData;
}) {
  registerPdfAssets(assets.fontSrc);
  const supportModules = data.supportModules.slice(0, 2);
  return (
    <Document
      title={`Карьерная траектория — ${data.primaryModule.name}`}
      author="Центр карьеры ИТМО"
      subject="Персональная карьерная траектория"
      creator="Карьерная траектория ИТМО"
    >
      <Page size={A4} style={styles.page} wrap={false}>
        <Header logoSrc={assets.logoSrc} />
        <View style={styles.pageBody}>
          <Text style={styles.eyebrow}>ВАША КАРЬЕРНАЯ ТРАЕКТОРИЯ</Text>
          <Text style={styles.mainHeading}>Куда двигаться дальше</Text>
          <Text style={styles.moduleHeading}>{data.primaryModule.name}</Text>
          <Text style={styles.goal}>{data.primaryModule.goal}</Text>
          <View style={styles.currentCard}>
            <Text style={styles.eyebrow}>СЕЙЧАС</Text>
            <Text style={styles.currentText}>{data.currentPoint}</Text>
          </View>
          <View style={styles.prioritiesBlock}>
            <Text style={styles.sectionHeading}>Ваши ориентиры</Text>
            {data.priorities.length ? (
              <View style={styles.pills}>
                {data.priorities.slice(0, 3).map((priority) => <Text key={priority} style={styles.pill}>{priority}</Text>)}
              </View>
            ) : (
              <Text style={styles.sectionSubtitle}>Ориентиры уточнятся после первых действий.</Text>
            )}
          </View>
          <PreviewRoute steps={data.steps} />
        </View>
        <Footer />
      </Page>

      <Page size={A4} style={styles.page}>
        <Header logoSrc={assets.logoSrc} />
        <View>
          <Text style={styles.eyebrow}>ГЛАВНАЯ ЧАСТЬ МАРШРУТА</Text>
          <Text style={styles.sectionHeading}>3 ближайших шага</Text>
          <Text style={styles.sectionSubtitle}>Не пытайтесь сделать всё сразу. Начните с этих трёх действий.</Text>
          <View style={{ marginTop: 14 }}>
            {data.steps.map((step, index) => <StepCard key={`${index}-${step}`} index={index} step={step} />)}
          </View>
          <View style={styles.supportSection}>
            <Text style={styles.eyebrow}>ДОПОЛНИТЕЛЬНЫЙ ФОКУС</Text>
            <Text style={styles.sectionHeading}>Что ещё держать в фокусе</Text>
            <View style={styles.supportGrid}>
              {supportModules.length ? supportModules.map((module) => (
                <View key={module.id} style={styles.supportCard}>
                  <Text style={styles.supportName}>{module.name}</Text>
                  <Text style={styles.supportGoal}>{module.goal}</Text>
                </View>
              )) : (
                <View style={[styles.supportCard, styles.supportCardEmpty]}>
                  <Text style={styles.supportName}>Дополнительные направления не требуются</Text>
                  <Text style={styles.supportGoal}>Сфокусируйтесь на основном маршруте и трёх ближайших действиях.</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.resourcesSection}>
            <Text style={styles.eyebrow}>ПРОВЕРЕННЫЕ СЛОТЫ</Text>
            <Text style={styles.sectionHeading}>Полезные ресурсы</Text>
            {data.resources.length ? (
              <View style={styles.resourceList}>{data.resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</View>
            ) : (
              <Text style={styles.noResources}>Для этой траектории пока нет связанных ресурсов. Новые ссылки здесь не подставляются автоматически.</Text>
            )}
          </View>

          <View
            style={styles.paceCard}
            wrap={(data.pace?.text?.length ?? 0) > KEEP_TOGETHER_TEXT_LIMIT}
          >
            <Text style={styles.eyebrow}>ВАШ ТЕМП</Text>
            <Text style={styles.paceLabel}>{data.paceLabel}</Text>
            <Text style={styles.paceText}>{data.pace?.text ?? "Темп уточнится после первых действий."}</Text>
          </View>
          <View style={styles.finalKeepTogether} wrap={false}>
            <View style={styles.checkpointCard}>
              <Text style={styles.checkpointEyebrow}>ЧЕРЕЗ 2–4 НЕДЕЛИ</Text>
              <Text style={styles.checkpointHeading}>У вас должно быть:</Text>
              <Text style={styles.checkpointText}>{data.checkpoint}</Text>
            </View>
            <Text style={styles.disclaimer} orphans={2} widows={2}>{data.disclaimer}</Text>
          </View>
        </View>
        <Footer />
      </Page>
    </Document>
  );
}
