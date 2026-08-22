import {
  createDefaultFrontHeader,
  createDefaultInsideHeader,
  createHeaderTextSlot,
} from "./HeaderDefaults";
import type { FrontHeaderTemplate, HeaderLayoutKind, InsideHeaderLayoutKind, InsideHeaderTemplate } from "@/types/header";

export const frontHeaderLayouts: Record<HeaderLayoutKind, FrontHeaderTemplate> = {
  "classic-centered": createDefaultFrontHeader({ layout: "classic-centered" }),
  "two-ears": createDefaultFrontHeader({
    layout: "two-ears",
    height: 78,
    masthead: createHeaderTextSlot({ template: "{{publicationName}}", fontFamily: "serif", fontSize: 30, fontWeight: "bold", align: "center" }),
    leftEar: createHeaderTextSlot({ template: "{{volume}} {{issue}}", fontWeight: "bold", align: "left", color: "#51483f" }),
    rightEar: createHeaderTextSlot({ template: "{{price}} | {{website}}", align: "right", color: "#51483f" }),
    componentVisibility: {
      skyline: false,
      leftEar: true,
      rightEar: true,
      logo: true,
      tagline: true,
      metadata: true,
      rules: true,
    },
  }),
  "skyline-masthead": createDefaultFrontHeader({
    layout: "skyline-masthead",
    height: 90,
    skyline: createHeaderTextSlot({ template: "{{section}} updates | {{city}} edition | Inside today", fontWeight: "bold", align: "center", color: "#fffdf8" }),
    masthead: createHeaderTextSlot({ template: "{{publicationName}}", fontFamily: "serif", fontSize: 28, fontWeight: "bold", align: "center" }),
    footerLine: createHeaderTextSlot({ template: "{{edition}} | {{day}}, {{date}} | {{price}}", align: "center", color: "#51483f" }),
    ruleColor: "#0f6f83",
    componentVisibility: {
      skyline: true,
      leftEar: false,
      rightEar: false,
      logo: true,
      tagline: true,
      metadata: true,
      rules: true,
    },
  }),
  "bold-hindi-regional": createDefaultFrontHeader({
    layout: "bold-hindi-regional",
    height: 76,
    masthead: createHeaderTextSlot({ template: "{{publicationNameHindi}}", fontFamily: "serif", fontSize: 32, fontWeight: "bold", align: "center" }),
    eyebrowLeft: createHeaderTextSlot({ template: "{{city}}", fontWeight: "bold", align: "left" }),
    eyebrowCenter: createHeaderTextSlot({ template: "{{edition}}", align: "center", color: "#51483f" }),
    footerLine: createHeaderTextSlot({ template: "{{date}} | {{price}}", align: "center", color: "#51483f" }),
    ruleColor: "#a33424",
  }),
  "modern-left-identity": createDefaultFrontHeader({
    layout: "modern-left-identity",
    height: 64,
    masthead: createHeaderTextSlot({ template: "{{publicationName}}", fontFamily: "sans", fontSize: 25, fontWeight: "bold", align: "left" }),
    footerLine: createHeaderTextSlot({ template: "{{date}} | {{edition}} | {{city}} | {{price}}", align: "right", color: "#51483f" }),
  }),
  "heritage-institutional": createDefaultFrontHeader({
    layout: "heritage-institutional",
    height: 82,
    masthead: createHeaderTextSlot({ template: "{{publicationName}}", fontFamily: "serif", fontSize: 30, fontWeight: "bold", align: "center" }),
    eyebrowCenter: createHeaderTextSlot({ template: "{{establishedText}}", align: "center", color: "#51483f" }),
    footerLine: createHeaderTextSlot({ template: "{{tagline}} | {{registrationNumber}}", align: "center", color: "#51483f" }),
  }),
};

export const insideHeaderLayouts: Record<InsideHeaderLayoutKind, InsideHeaderTemplate> = {
  "classic-rule-folio": createDefaultInsideHeader({ layout: "classic-rule-folio" }),
  "centered-publication": createDefaultInsideHeader({
    layout: "centered-publication",
    left: createHeaderTextSlot({ template: "{{section}} | {{date}}", align: "left", color: "#51483f" }),
    center: createHeaderTextSlot({ template: "{{publicationName}}", fontFamily: "serif", fontWeight: "bold", align: "center" }),
    right: createHeaderTextSlot({ template: "Page {{pageNumber}}", align: "right" }),
  }),
  "section-color-band": createDefaultInsideHeader({
    layout: "section-color-band",
    height: 30,
    left: createHeaderTextSlot({ template: "{{section}}", fontWeight: "bold", align: "left", color: "#fffdf8" }),
    center: createHeaderTextSlot({ template: "{{publicationName}}", align: "center" }),
    right: createHeaderTextSlot({ template: "{{date}} | {{pageNumber}}", align: "right" }),
    accentColor: "#0f6f83",
  }),
  "mirrored-facing-pages": createDefaultInsideHeader({
    layout: "mirrored-facing-pages",
    mirrored: true,
    left: createHeaderTextSlot({ template: "Page {{pageNumber}}", fontWeight: "bold", align: "left" }),
    center: createHeaderTextSlot({ template: "{{publicationName}}", fontFamily: "serif", fontWeight: "bold", align: "center" }),
    right: createHeaderTextSlot({ template: "{{section}} | {{date}}", align: "right", color: "#51483f" }),
  }),
  "compact-hindi-folio": createDefaultInsideHeader({
    layout: "compact-hindi-folio",
    height: 22,
    left: createHeaderTextSlot({ template: "{{publicationNameHindi}}", fontFamily: "serif", fontWeight: "bold", align: "left" }),
    center: createHeaderTextSlot({ template: "{{section}}", fontWeight: "bold", align: "center" }),
    right: createHeaderTextSlot({ template: "{{pageNumber}}", fontWeight: "bold", align: "right" }),
  }),
  "local-edition-folio": createDefaultInsideHeader({
    layout: "local-edition-folio",
    left: createHeaderTextSlot({ template: "{{date}}", align: "left", color: "#51483f" }),
    center: createHeaderTextSlot({ template: "{{city}} {{edition}}", fontWeight: "bold", align: "center" }),
    right: createHeaderTextSlot({ template: "{{section}} | Page {{pageNumber}}", align: "right" }),
  }),
};
