"use client";

/**
 * EditorialSlotPanel
 *
 * Renders inside GenerationWizardModal when the "Editorial Page" tab is active.
 *
 * Flow:
 *  1. Layout picker  (reuses existing LayoutPickerScreen logic)
 *  2. Slot detection  (calls composeEditorialPage from existing engine)
 *  3. N slot cards   (Paste / Browse / Choose Existing / Preview / Clear)
 *  4. Auto Fill toggle + Generate button
 *
 * Generation calls the existing importNewswireStories store action.
 * NO engines are modified.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { ChevronLeft, FileText, Link, Eye, Trash2, RefreshCw, X } from "lucide-react";
import { composeEditorialPage } from "@/engines/EditorialPageComposer/EditorialPageComposer";
import { WIZARD_EDITORIAL_PAGE_DESIGNS, type NewswireImportOptions, type WizardAction, type PageAdvertisementState } from "./GenerationWizardModal";
import type { NewswireStory, NewswireCategory } from "@/lib/newswire";
import type { TemplateId } from "@/engines/TemplateLayout/TemplateTypes";
import { NEWSWIRE_CATEGORIES } from "@/lib/newswire";
import {
  buildEditorialStories,
  getHealthSlotIndex,
  getRashifalSlotIndex,
  getTemplateColumnSpans,
  type EditorialFeedRecord,
  type RashifalRecord,
} from "@/lib/editorialNewswire";
import { getTemplateDefinition } from "@/engines/TemplateLayout/TemplateRegistry";
import { getEditorialRailLabel } from "@/engines/MasterPage/AuthorBlockGeometry";

// ─── Types ────────────────────────────────────────────────────────────────────

type SlotSource = "none" | "paste" | "browse" | "existing" | "manual";

/**
 * Copy typed straight into a slot.
 *
 * Held as separate fields rather than one blob of text because the composer
 * needs them separately — a headline is fitted and a body is flowed, and the
 * old "first line becomes the headline" rule silently mangled any story whose
 * opening line happened to be a sentence.
 */
type ManualEntry = {
  headline: string;
  summary: string;
  body: string;
  /** Data URL from the file picker, so the image travels with the story. */
  imageUrl: string;
  imageCaption: string;
  /**
   * The writer's portrait and name, as page 8 carries them: a small headshot in
   * the rail beside the leader, and again beside the signed comment.
   *
   * Kept separate from `imageUrl` because they are different things on the
   * page — the portrait identifies the author and sits in the rail, while the
   * main image illustrates the story. A box can carry both.
   */
  editorPortraitUrl: string;
  editorName: string;
  letterAuthor: string;
  letterLocation: string;
  letterEmail: string;
  letterPhone: string;
};

const emptyManualEntry = (): ManualEntry => ({
  headline: "",
  summary: "",
  body: "",
  imageUrl: "",
  imageCaption: "",
  editorPortraitUrl: "",
  editorName: "",
  letterAuthor: "",
  letterLocation: "",
  letterEmail: "",
  letterPhone: "",
});

type EditorialSlot = {
  id: string;
  source: SlotSource;
  story: NewswireStory | null;
  pasteText: string;
  previewOpen: boolean;
  /** Open state of the write-it-yourself form. */
  manualOpen: boolean;
  manual: ManualEntry;
};

type EditorialSlotPanelProps = {
  state: {
    layoutDesign: TemplateId;
    articleCount: number;
    category: NewswireCategory;
    bylineName: string;
    pageAdvertisements: PageAdvertisementState[];
  };
  dispatch: React.Dispatch<WizardAction>;
  layoutPreviews: Map<
    TemplateId,
    Array<{
      storyNumber: number;
      left: string;
      top: string;
      width: string;
      height: string;
    }>
  >;
  onImportNewswireStories: (
    category: string,
    articles: NewswireStory[],
    options: NewswireImportOptions,
  ) => void;
  buildImportOptions: () => NewswireImportOptions;
  onClose: () => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createSlot(index: number): EditorialSlot {
  return {
    id: `editorial-slot-${index}`,
    source: "none",
    story: null,
    pasteText: "",
    previewOpen: false,
    manualOpen: false,
    manual: emptyManualEntry(),
  };
}

/**
 * Turns a hand-written slot into a story.
 *
 * Hindi localized content is filled in as well as the bare fields: the store
 * resolves copy through `localized[language]` first, and a story that carries
 * only top-level fields is what made an editorial page refuse to build with
 * "Not enough Hindi articles are available to generate this page."
 */
function manualEntryToStory(entry: ManualEntry, index: number): NewswireStory {
  const headline = entry.headline.trim() || `Editorial ${index + 1}`;
  const body = entry.body.trim();
  const imageCaption = entry.imageCaption.trim();
  const editorName = entry.editorName.trim();
  const portrait = entry.editorPortraitUrl.trim();
  const editorSummary =
    entry.summary.trim() || (entry.body.trim().split(/(?<=[।.!?])\s/)[0] ?? "");
  const letterAuthor = entry.letterAuthor.trim();
  const letterLocation = entry.letterLocation.trim();
  const letterEmail = entry.letterEmail.trim();
  const letterPhone = entry.letterPhone.trim();

  // A box with only a portrait and no story photograph prints the portrait as
  // its image — which is exactly the सम्पादकीय rail on page 8. When a box has
  // both, the story photograph takes the image slot and the portrait rides
  // along on `editorPortraitUrl` for the rail furniture to pick up.
  const primaryImage = entry.imageUrl.trim() || portrait;
  const portraitIsPrimary = !entry.imageUrl.trim() && Boolean(portrait);

  return {
    id: `editorial-manual-${index}`,
    category: "Editorial",
    headline,
    subheadline: "",
    body,
    shortBody: body,
    mediumBody: body,
    longBody: body,
    summary: [],
    caption: portraitIsPrimary ? editorName : imageCaption,
    imageUrl: primaryImage,
    imageCaption: portraitIsPrimary ? editorName : imageCaption,
    sourceTitle: "",
    sourceUrl: "",
    publishedAt: null,
    // Byline carries the writer's name so it prints even when the portrait is
    // not the box's main image.
    bylineName: editorName,
    editorPortraitUrl: portrait,
    // Short summary printed under the name in the author rail.
    editorSummary,
    letterAuthor,
    letterLocation,
    letterEmail,
    letterPhone,
    localized: {
      hindi: {
        language: "hindi",
        headline,
        kicker: "",
        subheadings: [],
        subheadline: "",
        body,
        shortBody: body,
        mediumBody: body,
        longBody: body,
        caption: portraitIsPrimary ? editorName : imageCaption,
        imageCaption: portraitIsPrimary ? editorName : imageCaption,
        place: "",
        imageUrl: primaryImage,
        sourceUrl: "",
        category: "Editorial",
      },
    },
  } as NewswireStory;
}

function plainTextToStory(text: string, index: number): NewswireStory {
  const lines = text.trim().split("\n").filter(Boolean);
  const headline = lines[0] ?? `Editorial ${index + 1}`;
  const body = lines.slice(1).join(" ") || text;
  return {
    id: `editorial-manual-${Date.now()}-${index}`,
    headline,
    subheadline: "",
    body,
    englishBody: body,
    hindiBody: "",
    author: "",
    source: "Editorial",
    category: "Editorial",
    language: "english",
    imageUrl: "",
    publishedAt: new Date().toISOString(),
  } as unknown as NewswireStory;
}

function emptyEditorialStory(index: number): NewswireStory {
  return {
    id: `editorial-empty-${index}`,
    category: "Editorial",
    headline: "",
    subheadline: "",
    body: "",
    shortBody: "",
    mediumBody: "",
    longBody: "",
    summary: [],
    caption: "",
    imageUrl: "",
    imageCaption: "",
    sourceTitle: "",
    sourceUrl: "",
    publishedAt: null,
    localized: {
      hindi: {
        language: "hindi",
        headline: "",
        kicker: "",
        subheadings: [],
        subheadline: "",
        body: "",
        shortBody: "",
        mediumBody: "",
        longBody: "",
        caption: "",
        imageCaption: "",
        place: "",
        imageUrl: "",
        sourceUrl: "",
        category: "Editorial",
      },
    },
  } as NewswireStory;
}

// ─── Slot Card ────────────────────────────────────────────────────────────────

const SlotCard = memo(function SlotCard({
  slot,
  index,
  onSetPaste,
  onBrowse,
  onClear,
  onTogglePreview,
  onSetManual,
  onToggleManual,
  onPickImage,
  onPickPortrait,
  fileInputRef,
  imageInputRef,
  portraitInputRef,
  capacityWords,
  storyNumber,
  manualOnly = false,
}: {
  slot: EditorialSlot;
  index: number;
  onSetPaste: (index: number, text: string) => void;
  onBrowse: (index: number, file: File) => void;
  onClear: (index: number) => void;
  onTogglePreview: (index: number) => void;
  onSetManual: (index: number, patch: Partial<ManualEntry>) => void;
  onToggleManual: (index: number) => void;
  onPickImage: (index: number, file: File) => void;
  onPickPortrait: (index: number, file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  portraitInputRef: React.RefObject<HTMLInputElement | null>;
  /** Roughly how many words this box holds, from its share of the page. */
  capacityWords: number;
  storyNumber: number;
  manualOnly?: boolean;
}) {
  const assigned = slot.source !== "none";
  const manualOpen = manualOnly || slot.manualOpen;
  const isLeftRail = storyNumber === 1;
  const isSignedComment = storyNumber === 2;
  const isLetter = storyNumber === 4;
  const showPortraitFields = isLeftRail || isSignedComment;
  const showStoryImageField = isSignedComment || storyNumber === 5;

  // Which rail this card feeds, if any. Cards are zero-based, story numbers
  // one-based; a card that is not one of the two signed pieces gets no rail and
  // therefore no portrait fields.
  const railLabel = getEditorialRailLabel(storyNumber) || (isLeftRail ? "संपादकीय" : "");

  // Fit guidance. Deliberately phrased as "about" — the composer decides the
  // real fit when it flows the copy, and it trims at a sentence boundary, so a
  // word count here is a guide rather than a promise.
  const words = slot.manual.body.trim() ? slot.manual.body.trim().split(/\s+/).length : 0;
  const fitHint =
    words === 0
      ? `इस बॉक्स में लगभग ${capacityWords} शब्द आ सकते हैं।`
      : words > capacityWords
        ? `${words} शब्द — इस बॉक्स की क्षमता से लगभग ${words - capacityWords} ज़्यादा। अंत को पूर्ण विराम पर काटा जाएगा।`
        : `${words} में से लगभग ${capacityWords} शब्द।`;

  return (
    <div className={`editorial-slot-card${assigned ? " assigned" : ""}${showStoryImageField ? "" : " no-story-image"}`}>
      <div className="editorial-slot-header">
        <span className="editorial-slot-number">□ एडिटोरियल स्लॉट {index + 1}</span>
        {assigned ? (
          <span className="editorial-slot-badge">
            {slot.source === "paste" ? "पेस्ट किया गया" : slot.source === "browse" ? "फ़ाइल" : "चुना गया"}
          </span>
        ) : (
          <span className="editorial-slot-badge empty">खाली</span>
        )}
      </div>

      {/* Story preview when assigned */}
      {assigned && slot.story && slot.previewOpen ? (
        <div className="editorial-slot-preview">
          <strong>{slot.story.headline}</strong>
          <p>
            {String(
              (slot.story as unknown as Record<string, unknown>).body ?? 
              (slot.story as unknown as Record<string, unknown>).englishBody ?? ""
            ).slice(0, 120)}…
          </p>
        </div>
      ) : null}

      {/* Paste mode */}
      {(slot.source === "paste" || slot.source === "none") && !manualOpen && !manualOnly ? (
        <textarea
          className="editorial-slot-paste"
          placeholder={`यहाँ खबर ${index + 1} पेस्ट करें…\nपहली पंक्ति हेडलाइन बन जाएगी।`}
          value={slot.pasteText}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onSetPaste(index, e.target.value)}
          rows={3}
        />
      ) : null}

      {/*
        Write-it-yourself form. Separate fields rather than one textarea: the
        composer fits a headline and flows a body differently, so guessing the
        split from a line break mangles any story that opens with a sentence.
      */}
      {manualOpen ? (
        <div className="editorial-manual-form">
          <label>
            <span>हेडिंग</span>
            <input
              type="text"
              value={slot.manual.headline}
              placeholder="इस बॉक्स की हेडलाइन"
              onChange={(e) => onSetManual(index, { headline: e.target.value })}
            />
          </label>
          {isSignedComment ? (
            <label>
              <span>Summary</span>
              <textarea
                rows={2}
                value={slot.manual.summary}
                placeholder="Short summary for the विचार मंथन rail"
                onChange={(e) => onSetManual(index, { summary: e.target.value })}
              />
            </label>
          ) : null}
          <label>
            <span>मुख्य लेख</span>
            <textarea
              rows={5}
              value={slot.manual.body}
              placeholder="मुख्य लेख। बॉक्स में फ़िट करने के लिए इसे नज़दीकी वाक्य पर काटा जाएगा।"
              onChange={(e) => onSetManual(index, { body: e.target.value })}
            />
          </label>
          <label>
            <span>तस्वीर का कैप्शन</span>
            <input
              type="text"
              value={slot.manual.imageCaption}
              placeholder="वैकल्पिक"
              onChange={(e) => onSetManual(index, { imageCaption: e.target.value })}
            />
          </label>
          <div className="editorial-manual-image">
            <button type="button" className="editorial-slot-btn" onClick={() => imageInputRef.current?.click()}>
              <FileText size={13} />
              {slot.manual.imageUrl ? "तस्वीर बदलें" : "तस्वीर जोड़ें"}
            </button>
            {slot.manual.imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={slot.manual.imageUrl} alt="" className="editorial-manual-thumb" />
                <button
                  type="button"
                  className="editorial-slot-btn danger"
                  onClick={() => onSetManual(index, { imageUrl: "" })}
                >
                  <Trash2 size={13} />
                  हटाएं
                </button>
              </>
            ) : null}
          </div>

          {/*
            The writer's portrait and name, offered ONLY on the two boxes that
            carry a rail — सम्पादकीय and विचार मंथन. Every other box on the page
            prints no portrait, so offering the fields there invited uploads that
            would never appear.

            Each is named for its own rail rather than both saying "editor", so
            it is obvious which picture and which writer belongs to which piece.
          */}
          {showPortraitFields ? (
            <>
          <label>
            <span>{railLabel} — लेखक का नाम</span>
            <input
              type="text"
              value={slot.manual.editorName}
              placeholder={`${railLabel} की तस्वीर के नीचे छपने वाला नाम`}
              onChange={(e) => onSetManual(index, { editorName: e.target.value })}
            />
          </label>
          <div className="editorial-manual-image">
            <button
              type="button"
              className="editorial-slot-btn"
              onClick={() => portraitInputRef.current?.click()}
            >
              <FileText size={13} />
              {slot.manual.editorPortraitUrl
                ? `${railLabel} की तस्वीर बदलें`
                : `${railLabel} की तस्वीर जोड़ें`}
            </button>
            {slot.manual.editorPortraitUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slot.manual.editorPortraitUrl}
                  alt=""
                  className="editorial-manual-thumb portrait"
                />
                <button
                  type="button"
                  className="editorial-slot-btn danger"
                  onClick={() => onSetManual(index, { editorPortraitUrl: "" })}
                >
                  <Trash2 size={13} />
                  हटाएं
                </button>
              </>
            ) : null}
          </div>
            </>
          ) : null}
          {isLetter ? (
            <div className="editorial-manual-grid">
              <label>
                <span>Letter author</span>
                <input
                  type="text"
                  value={slot.manual.letterAuthor}
                  placeholder="रेश नामदेव"
                  onChange={(e) => onSetManual(index, { letterAuthor: e.target.value })}
                />
              </label>
              <label>
                <span>Location</span>
                <input
                  type="text"
                  value={slot.manual.letterLocation}
                  placeholder="जिन्सी, भोपाल"
                  onChange={(e) => onSetManual(index, { letterLocation: e.target.value })}
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  type="text"
                  value={slot.manual.letterEmail}
                  placeholder="optional"
                  onChange={(e) => onSetManual(index, { letterEmail: e.target.value })}
                />
              </label>
              <label>
                <span>WhatsApp / phone</span>
                <input
                  type="text"
                  value={slot.manual.letterPhone}
                  placeholder="optional"
                  onChange={(e) => onSetManual(index, { letterPhone: e.target.value })}
                />
              </label>
            </div>
          ) : null}
          <p className="editorial-manual-fit">{fitHint}</p>
        </div>
      ) : null}

      {!manualOnly ? <div className="editorial-slot-actions">
        {slot.source === "none" || slot.source === "paste" || slot.source === "manual" ? (
          <>
            <button
              type="button"
              className={`editorial-slot-btn${manualOpen ? " active" : ""}`}
              onClick={() => onToggleManual(index)}
              title="इस बॉक्स को खुद लिखें"
            >
              <FileText size={13} />
              {slot.manualOpen ? "लिखना बंद करें" : "खुद लिखें"}
            </button>
            {!manualOpen ? (
              <button
                type="button"
                className="editorial-slot-btn"
                onClick={() => fileInputRef.current?.click()}
                title="फ़ाइल चुनें"
              >
                <FileText size={13} />
                फ़ाइल चुनें
              </button>
            ) : null}
          </>
        ) : null}

        {assigned ? (
          <>
            <button
              type="button"
              className="editorial-slot-btn"
              onClick={() => onTogglePreview(index)}
              title="खबर देखें"
            >
              <Eye size={13} />
              {slot.previewOpen ? "छुपाएं" : "देखें"}
            </button>
            <button
              type="button"
              className="editorial-slot-btn danger"
              onClick={() => onClear(index)}
              title="स्लॉट साफ़ करें"
            >
              <Trash2 size={13} />
              साफ़ करें
            </button>
          </>
        ) : null}
      </div> : null}

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onBrowse(index, file);
          e.target.value = "";
        }}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPickImage(index, file);
          e.target.value = "";
        }}
      />

      <input
        ref={portraitInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPickPortrait(index, file);
          e.target.value = "";
        }}
      />
    </div>
  );
});

// ─── Main Panel ───────────────────────────────────────────────────────────────

export const EditorialSlotPanel = memo(function EditorialSlotPanel({
  state,
  dispatch,
  layoutPreviews,
  onImportNewswireStories,
  buildImportOptions,
  onClose,
}: EditorialSlotPanelProps) {
  const [phase, setPhase] = useState<"layout" | "slots">("layout");
  const [slots, setSlots] = useState<EditorialSlot[]>([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null);
  const [autoFill, setAutoFill] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Where empty slots come from. The editorial desk's own feed is the default
   * for this page; the category grid is the older newswire path, kept for when
   * the desk has filed nothing.
   */
  const [autoFillSource, setAutoFillSource] = useState<"editorial" | "category">("editorial");
  /** Feed fetched ahead of generating, so its contents can be seen first. */
  const [feed, setFeed] = useState<{
    articles: EditorialFeedRecord[];
    rashifal: RashifalRecord[];
    health: EditorialFeedRecord[];
  } | null>(null);
  const [fetchingFeed, setFetchingFeed] = useState(false);
  const [feedStatus, setFeedStatus] = useState<string | null>(null);

  const fileInputRefs = useRef<Array<React.RefObject<HTMLInputElement | null>>>([]);
  const imageInputRefs = useRef<Array<React.RefObject<HTMLInputElement | null>>>([]);
  const portraitInputRefs = useRef<Array<React.RefObject<HTMLInputElement | null>>>([]);

  // Derive slot count from the selected layout via composeEditorialPage
  const detectedSlotCount = useMemo(() => {
    try {
      const composition = composeEditorialPage({ storyCount: state.articleCount });
      return composition?.slots.length ?? state.articleCount;
    } catch {
      return state.articleCount;
    }
  }, [state.articleCount]);

  // When entering "slots" phase, initialize slots array
  useEffect(() => {
    if (phase === "slots") {
      setSlots(
        Array.from({ length: detectedSlotCount }, (_, i) => createSlot(i)),
      );
      setSelectedSlotIndex(0);
      setEditingSlotIndex(null);
      // Real ref objects, not undefined placeholders: the buttons call
      // `ref.current?.click()`, which throws outright on an undefined ref.
      fileInputRefs.current = Array.from(
        { length: detectedSlotCount },
        () => ({ current: null }),
      );
      imageInputRefs.current = Array.from(
        { length: detectedSlotCount },
        () => ({ current: null }),
      );
      portraitInputRefs.current = Array.from(
        { length: detectedSlotCount },
        () => ({ current: null }),
      );
    }
  }, [phase, detectedSlotCount]);

  // ── Slot handlers ──────────────────────────────────────────────────────────

  const handleSetPaste = useCallback((index: number, text: string) => {
    setSlots((prev) =>
      prev.map((slot, i) =>
        i !== index
          ? slot
          : {
              ...slot,
              pasteText: text,
              source: text.trim() ? "paste" : "none",
              story: text.trim() ? plainTextToStory(text, index) : null,
            },
      ),
    );
  }, []);

  const handleBrowse = useCallback((index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setSlots((prev) =>
        prev.map((slot, i) =>
          i !== index
            ? slot
            : {
                ...slot,
                pasteText: text,
                source: "browse",
                story: plainTextToStory(text, index),
              },
        ),
      );
    };
    reader.readAsText(file);
  }, []);

  const handleClear = useCallback((index: number) => {
    setSlots((prev) =>
      prev.map((slot, i) =>
        i !== index ? slot : createSlot(i),
      ),
    );
  }, []);

  const handleTogglePreview = useCallback((index: number) => {
    setSlots((prev) =>
      prev.map((slot, i) =>
        i !== index ? slot : { ...slot, previewOpen: !slot.previewOpen },
      ),
    );
  }, []);

  /**
   * Rough word capacity per box, from its share of the page.
   *
   * A guide for the writer, not a rule — the composer decides the real fit when
   * it flows the copy and trims at a sentence boundary. Derived from column
   * span and band depth so a one-column rail is not told it holds as much as
   * the five-column comment.
   */
  const slotCapacityWords = useMemo(() => {
    const template = getTemplateDefinition(state.layoutDesign);

    if (!template) {
      return [];
    }

    const rowRatio = new Map(
      (template.rowRhythm ?? []).map((row) => [row.row, row.baseRatio]),
    );

    return [...template.slots]
      .sort((a, b) => a.storyNumber - b.storyNumber)
      .map((slot) => {
        const depth = rowRatio.get(slot.row) ?? 1 / Math.max(1, rowRatio.size || 1);
        // ~1050 words fills a full-width band of the whole sheet at body size.
        return Math.max(40, Math.round((slot.columnSpan / 6) * depth * 1050 * 6));
      });
  }, [state.layoutDesign]);

  // ── Manual entry ───────────────────────────────────────────────────────────

  const handleToggleManual = useCallback((index: number) => {
    setSlots((prev) =>
      prev.map((slot, i) => (i !== index ? slot : { ...slot, manualOpen: !slot.manualOpen })),
    );
  }, []);

  /**
   * Applies a field edit and keeps the slot's assigned state honest: a slot
   * counts as filled once it has a heading or body, and drops back to empty if
   * the writer clears both, so the "n / n slots assigned" figure stays true.
   */
  const handleSetManual = useCallback((index: number, patch: Partial<ManualEntry>) => {
    setSlots((prev) =>
      prev.map((slot, i) => {
        if (i !== index) {
          return slot;
        }

        const manual = { ...slot.manual, ...patch };
        const hasCopy = Boolean(manual.headline.trim() || manual.body.trim());

        return {
          ...slot,
          manual,
          source: hasCopy ? "manual" : slot.source === "manual" ? "none" : slot.source,
          story: hasCopy ? manualEntryToStory(manual, index) : slot.source === "manual" ? null : slot.story,
        };
      }),
    );
  }, []);

  const handlePickPortrait = useCallback((index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const editorPortraitUrl = typeof reader.result === "string" ? reader.result : "";
      if (editorPortraitUrl) {
        handleSetManual(index, { editorPortraitUrl });
      }
    };
    reader.readAsDataURL(file);
  }, [handleSetManual]);

  const handlePickImage = useCallback((index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const imageUrl = typeof reader.result === "string" ? reader.result : "";
      if (imageUrl) {
        handleSetManual(index, { imageUrl });
      }
    };
    reader.readAsDataURL(file);
  }, [handleSetManual]);

  // ── Editorial feed ─────────────────────────────────────────────────────────

  /**
   * Fetches the desk's editorial copy and the day's राशिफल.
   *
   * Separate from Generate on purpose: the page used to fetch silently at the
   * moment it built, so there was no way to see what the desk had filed — or
   * that it had filed nothing — until the page was already on screen.
   */
  const handleFetchFeed = useCallback(async () => {
    setFetchingFeed(true);
    setError(null);

    try {
      const response = await fetch(`/api/editorial?limit=50&ts=${Date.now()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        articles?: EditorialFeedRecord[];
        rashifal?: RashifalRecord[];
        health?: EditorialFeedRecord[];
      } | null;

      if (!payload?.success || !Array.isArray(payload.articles)) {
        throw new Error(payload?.error ?? "एडिटोरियल फ़ीड तक नहीं पहुँच सके।");
      }

      const articles = payload.articles;
      const rashifal = payload.rashifal ?? [];
      const health = payload.health ?? [];
      setFeed({ articles, rashifal, health });
      setFeedStatus(
        `${articles.length} एडिटोरियल लेख और ${rashifal.length} राशिफल तैयार हैं।` +
          (articles.length < slots.length - 1
            ? " लाइव फ़ीड कम है; बाकी बॉक्स खाली रहेंगे।"
            : ""),
      );
      setAutoFillSource("editorial");
    } catch (err) {
      setFeed(null);
      setFeedStatus(null);
      setError(err instanceof Error ? err.message : "एडिटोरियल फ़ीड तक नहीं पहुँच सके।");
    } finally {
      setFetchingFeed(false);
    }
  }, [slots.length]);

  // ── Generate ───────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);

    try {
      const assignedSlots = slots.filter((s) => s.source !== "none" && s.story);
      const emptyCount = slots.length - assignedSlots.length;
      // Stories built from the editorial feed, indexed by slot rather than
      // consumed in order — a slot the user filled by hand keeps their choice.
      let editorialStories: NewswireStory[] = [];

      let autoFetchedStories: NewswireStory[] = [];

      if (autoFill && emptyCount > 0 && autoFillSource === "editorial") {
        // The editorial page has its own feed: the desk's leader and comment
        // copy, plus the day's राशिफल. It is fetched per slot rather than as a
        // flat list because the headline a box gets depends on how wide it is —
        // a one-column box takes the short title, a wider one the fuller
        // secondary headline.
        try {
          // Generate always refetches the editorial desk feed. Reusing the
          // earlier preview feed made it too easy to mistake stale in-memory
          // copy for live API data while testing.
          const payload = ((await (
            await fetch(`/api/editorial?limit=50&ts=${Date.now()}`, { cache: "no-store" })
          ).json().catch(() => null)) as {
                success?: boolean;
                articles?: EditorialFeedRecord[];
                rashifal?: RashifalRecord[];
                health?: EditorialFeedRecord[];
              } | null);

          if (payload?.success && Array.isArray(payload.articles) && payload.articles.length > 0) {
            const columnSpans = getTemplateColumnSpans(state.layoutDesign);
            editorialStories = buildEditorialStories({
              feed: { articles: payload.articles, rashifal: payload.rashifal ?? [], health: payload.health ?? [] },
              columnSpans,
              category: "Editorial",
              rashifalSlotIndex: getRashifalSlotIndex(state.layoutDesign),
              healthSlotIndex: getHealthSlotIndex(state.layoutDesign),
            });
          }
        } catch {
          // Leave editorialStories empty so live-feed problems remain visible.
        }

      }

      // The category path is only for the non-editorial auto-fill option.
      if (autoFill && emptyCount > 0 && autoFillSource !== "editorial" && editorialStories.length === 0) {
        try {
          const response = await fetch(
            `/api/newswire?category=${encodeURIComponent(state.category)}&language=english&limit=${emptyCount + 2}`,
          );
          const payload = (await response.json().catch(() => null)) as {
            success?: boolean;
            data?: NewswireStory[];
          } | null;
          if (Array.isArray(payload?.data)) {
            autoFetchedStories = payload.data.slice(0, emptyCount);
          }
        } catch {
          autoFetchedStories = [];
        }
      }

      // Build final article array in slot order
      let autoIndex = 0;
      const articles: NewswireStory[] = slots.map((slot, slotIndex) => {
        if (slot.source !== "none" && slot.story) {
          return slot.story;
        }
        // The editorial feed is already keyed by slot, so the box keeps the
        // headline chosen for its width and the horoscope stays in its own box.
        if (autoFill && editorialStories[slotIndex]) {
          return editorialStories[slotIndex];
        }
        if (autoFill && autoFetchedStories[autoIndex]) {
          return autoFetchedStories[autoIndex++];
        }
        // Explicit empty slot: no preloaded editorial copy during live testing.
        return emptyEditorialStory(slotIndex);
      });

      // Call existing importNewswireStories — all engines run as normal
      onImportNewswireStories("Editorial", articles, buildImportOptions());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "एडिटोरियल पेज नहीं बन सका।");
    } finally {
      setGenerating(false);
    }
  }, [
    slots,
    autoFill,
    state.category,
    // Read when mapping the feed onto slots — the headline a box gets depends
    // on its column span, which comes from the selected layout.
    state.layoutDesign,
    // Which feed fills the empty boxes, and the copy already pulled down.
    autoFillSource,
    feed,
    buildImportOptions,
    onImportNewswireStories,
    onClose,
  ]);

  // ── Layout Picker phase ────────────────────────────────────────────────────

  if (phase === "layout") {
    const previewSlots = layoutPreviews.get(state.layoutDesign) ?? [];
    return (
      <div className="generation-wizard-screen">
        <p className="generation-wizard-note">
          लेआउट टेम्पलेट चुनें। लेख बॉक्स की संख्या से एडिटोरियल स्लॉट तय होते हैं।
        </p>

        <div className="editorial-layout-picker">
          <div className="generation-layout-grid">
            {WIZARD_EDITORIAL_PAGE_DESIGNS.map((layout) => {
              const slots = layoutPreviews.get(layout.id) ?? [];
              const selectLayout = () => dispatch({ type: "SET_LAYOUT", layout: layout.id });
              return (
                <div
                  key={layout.id}
                  role="button"
                  tabIndex={0}
                  className={`layout-preview-button${state.layoutDesign === layout.id ? " selected" : ""}`}
                  onClick={selectLayout}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectLayout();
                    }
                  }}
                >
                  <div className="layout-preview-card">
                    <div className="layout-preview-count-badge">{layout.storyCount}</div>
                    <div className="layout-preview-frame">
                      {slots.map((slot) => (
                        <div
                          key={slot.storyNumber}
                          className="layout-preview-slot"
                          style={{ left: slot.left, top: slot.top, width: slot.width, height: slot.height }}
                        >
                          {slot.storyNumber}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="layout-preview-meta">
                    <strong>{layout.name}</strong>
                    <span>{layout.storyCount} स्लॉट</span>
                  </div>
                  <button
                    type="button"
                    className="layout-preview-select-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectLayout();
                      setPhase("slots");
                    }}
                  >
                    चुनें →
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="generation-wizard-actions">
          <button
            type="button"
            className="primary"
            onClick={() => setPhase("slots")}
          >
            आगे बढ़ें →
          </button>
        </div>
      </div>
    );
  }

  // ── Slot Assignment phase ──────────────────────────────────────────────────

  const assignedCount = slots.filter((s) => s.source !== "none").length;
  const previewSlots = layoutPreviews.get(state.layoutDesign) ?? [];
  const editingSlot = editingSlotIndex !== null ? slots[editingSlotIndex] ?? null : null;
  const editingStoryNumber =
    editingSlotIndex !== null
      ? previewSlots[editingSlotIndex]?.storyNumber ?? editingSlotIndex + 1
      : 0;

  return (
    <div className="generation-wizard-screen">
      <div className="editorial-panel-header">
        <button
          type="button"
          className="editorial-back-btn"
          onClick={() => setPhase("layout")}
        >
          <ChevronLeft size={14} /> लेआउट पर वापस जाएं
        </button>
        <div className="editorial-progress">
          <span>
            {assignedCount} / {slots.length} स्लॉट भरे गए
          </span>
          <div className="editorial-progress-bar">
            <div
              className="editorial-progress-fill"
              style={{ width: `${slots.length > 0 ? (assignedCount / slots.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="editorial-slot-workspace">
        <div className="editorial-slot-map-card">
          <div className="editorial-slot-map-frame">
            {previewSlots.map((slot, index) => {
              const panelSlot = slots[index];
              const filled = Boolean(panelSlot && panelSlot.source !== "none");
              return (
                <button
                  key={slot.storyNumber}
                  type="button"
                  className={`editorial-slot-map-box${selectedSlotIndex === index ? " selected" : ""}${filled ? " filled" : ""}`}
                  style={{ left: slot.left, top: slot.top, width: slot.width, height: slot.height }}
                  onClick={() => {
                    setSelectedSlotIndex(index);
                    setEditingSlotIndex(index);
                  }}
                  title={`Box ${slot.storyNumber}`}
                >
                  {slot.storyNumber}
                </button>
              );
            })}
          </div>
        </div>

        <div className="editorial-slot-controls-column">
          <div className="editorial-auto-fill">
        <label>
          <input
            type="checkbox"
            checked={autoFill}
            onChange={(e) => setAutoFill(e.target.checked)}
          />
          <span>बाकी खाली स्लॉट अपने-आप भरें</span>
        </label>
        <p>
          {autoFill
            ? autoFillSource === "editorial"
              ? `${slots.length - assignedCount} खाली स्लॉट एडिटोरियल फ़ीड से भरे जाएंगे।`
              : `${slots.length - assignedCount} खाली स्लॉट ${state.category} श्रेणी से अपने-आप भरे जाएंगे।`
            : "खाली स्लॉट खाली ही रहेंगे।"}
        </p>
      </div>

      {autoFill ? (
        <div className="editorial-source-row">
          <label>खाली स्लॉट कहाँ से भरें:</label>
          <div className="editorial-source-choice">
            <button
              type="button"
              className={autoFillSource === "editorial" ? "selected" : ""}
              onClick={() => setAutoFillSource("editorial")}
            >
              एडिटोरियल डेस्क + राशिफल
            </button>
            <button
              type="button"
              className={autoFillSource === "category" ? "selected" : ""}
              onClick={() => setAutoFillSource("category")}
            >
              न्यूज़ श्रेणी
            </button>
          </div>
          <p className="editorial-source-note">
            {autoFillSource === "editorial"
              ? feedStatus ??
                "डेस्क की एडिटोरियल फ़ीड, आज के राशिफल के साथ उसके अपने बॉक्स में। फ़ीड कम हो तो बाकी बॉक्स खाली रहेंगे।"
              : `${state.category} श्रेणी से सामान्य न्यूज़वायर सामग्री।`}
          </p>
          <button type="button" className="secondary" onClick={() => void handleFetchFeed()} disabled={fetchingFeed}>
            {fetchingFeed ? "लाया जा रहा है…" : "एडिटोरियल + राशिफल लाएं"}
          </button>
        </div>
      ) : null}

      {/*
        The category grid only governs the newswire path. Hiding it when the
        editorial feed is selected stops the panel claiming a page will be
        filled from a category it will not actually use.
      */}
      {autoFill && autoFillSource === "category" ? (
        <div className="editorial-category-row">
          <label>अपने-आप भरने के लिए श्रेणी:</label>
          <div className="generation-category-grid" style={{ maxHeight: 120, overflowY: "auto" }}>
            {NEWSWIRE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={(state.category as string) === cat ? "selected" : ""}
                onClick={() => dispatch({ type: "SET_CATEGORY", category: cat })}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="generation-wizard-error">{error}</p> : null}

      <div className="generation-wizard-actions">
        <button type="button" className="secondary" onClick={() => setPhase("layout")}>
          वापस
        </button>
        <button
          type="button"
          className="primary"
          disabled={generating || (assignedCount === 0 && !autoFill)}
          onClick={() => void handleGenerate()}
        >
          {generating ? (
            <>
              <RefreshCw size={14} className="spin" /> बन रहा है…
            </>
          ) : (
            "एडिटोरियल पेज बनाएं"
          )}
        </button>
      </div>
        </div>
      </div>

      {editingSlot && editingSlotIndex !== null ? (
        <div className="editorial-slot-popup-backdrop" onClick={() => setEditingSlotIndex(null)}>
          <div className="editorial-slot-popup" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="editorial-slot-popup-close"
              onClick={() => setEditingSlotIndex(null)}
              aria-label="Close slot editor"
            >
              <X size={18} />
            </button>
            <SlotCard
              key={editingSlot.id}
              slot={editingSlot}
              index={editingSlotIndex}
              storyNumber={editingStoryNumber}
              manualOnly
              onSetPaste={handleSetPaste}
              onBrowse={handleBrowse}
              onClear={handleClear}
              onTogglePreview={handleTogglePreview}
              onSetManual={handleSetManual}
              onToggleManual={handleToggleManual}
              onPickImage={handlePickImage}
              onPickPortrait={handlePickPortrait}
              fileInputRef={fileInputRefs.current[editingSlotIndex]}
              imageInputRef={imageInputRefs.current[editingSlotIndex]}
              portraitInputRef={portraitInputRefs.current[editingSlotIndex]}
              capacityWords={slotCapacityWords[editingSlotIndex] ?? 250}
            />
            <button
              type="button"
              className="editorial-slot-popup-done"
              onClick={() => setEditingSlotIndex(null)}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});
