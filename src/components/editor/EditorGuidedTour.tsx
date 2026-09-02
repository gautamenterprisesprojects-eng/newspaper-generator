"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type EditorTourStep = {
  target: string;
  title: string;
  body: string;
  placement?: "auto" | "top" | "bottom";
};

type Rect = { top: number; left: number; width: number; height: number };

export const EDITOR_TOUR_EVENT = "newspaper-editor:start-tour";
export const EDITOR_TOUR_SEEN_KEY = "newspaper-editor-tour-seen-v1";
export const EDITOR_TOUR_ENABLED_KEY = "newspaper-editor-tour-enabled";
export const EDITOR_TOUR_SETTING_EVENT = "newspaper-editor:tour-setting-changed";

const PAD = 8;
const CARD_GAP = 72;
const getViewportHeight = () => window.visualViewport?.height ?? window.innerHeight;
const getStepByTarget = (steps: EditorTourStep[], target: string) =>
  steps.find((step) => step.target === target);
const isContextIntroTarget = (target: string) =>
  target === "editor-section-tabs" || target.startsWith("editor-tab-");
const getFirstActionableIndex = (steps: EditorTourStep[]) => {
  const index = steps.findIndex((item) => !isContextIntroTarget(item.target));
  return Math.max(0, index);
};

export const EDITOR_TOUR_STEPS: EditorTourStep[] = [
  {
    target: "editor-generate-layout",
    title: "लेआउट विज़ार्ड खोलें",
    body: "नया पेज बनाना या मौजूदा पेज बदलना हो तो पहले Generate Layout खोलें। यहीं से डिज़ाइन, रंग और खबरें सेट होंगी।",
  },
  {
    target: "editor-live-layout-toggle",
    title: "लाइव लेआउट खोलें",
    body: "Mobile पर बाईं layout sheet छोटी रहती है। खबर बदलने के लिए पहले इसे बड़ा करें, फिर numbered boxes साफ दिखेंगे।",
  },
  {
    target: "editor-live-layout-panel",
    title: "लाइव पेज लेआउट",
    body: "यह left side live map current PDF page का छोटा version है। किसी एक खबर को बदलना हो तो पूरा page regenerate करने की जरूरत नहीं, इसी panel से सिर्फ वही box update करें।",
  },
  {
    target: "editor-live-layout-boxes",
    title: "ये boxes clickable हैं",
    body: "यह पूरा map current page की कहानी दिखाता है। हर numbered block page की एक खबर है, इसलिए पहले map देखकर तय करें कि कौन सी खबर बदलनी है।",
  },
  {
    target: "editor-live-layout-click-box",
    title: "News box पर click करें",
    body: "अब जिस खबर को बदलना है उसके number वाले box पर सीधे click करें। Click करते ही edit popup खुलेगा, जहाँ text/photo बदल सकते हैं।",
  },
  {
    target: "editor-live-layout-selected",
    title: "Selected box confirm करें",
    body: "यहाँ selected box का number और headline दिखती है। Replacement load करने से पहले confirm कर लें कि सही article चुना हुआ है।",
  },
  {
    target: "editor-live-layout-load",
    title: "Replacement news load करें",
    body: "सही box select होने के बाद Load Replacement News दबाएं। यह उसी box के लिए नई खबरें दिखाएगा; बाकी page layout और stories वैसी ही रहेंगी।",
  },
  {
    target: "editor-live-replace-popup",
    title: "Box edit popup",
    body: "Box click करने पर यह popup खुलता है। यहाँ सिर्फ selected story की details बदलें; पूरा page layout वैसा ही रहेगा।",
  },
  {
    target: "editor-live-replace-headline",
    title: "Headline और subheadline",
    body: "नई headline यहाँ लिखें। नीचे suggested words देखकर text छोटा-बड़ा करें ताकि box में fit अच्छा रहे।",
  },
  {
    target: "editor-live-replace-body",
    title: "Body text fit करें",
    body: "Article body यहाँ बदलें। Word hint से अंदाजा मिलेगा कि selected box में कितने शब्द ठीक बैठेंगे।",
  },
  {
    target: "editor-live-replace-image",
    title: "Photo बदलनी हो तो",
    body: "Image optional है। जरूरत हो तो Choose image से photo लगाएं, caption भरें, या image हटाकर text-only story रखें।",
  },
  {
    target: "editor-live-replace-done",
    title: "सिर्फ यही article replace करें",
    body: "सब ठीक लगे तो Replace current article दबाएं। Canvas और PDF preview में यही selected box update होगा।",
  },
  {
    target: "editor-section-tabs",
    title: "पहले पेज का सेक्शन समझें",
    body: "ऊपर चार tabs हैं: फ्रंट पेज, इनसाइड पेजेज़, एडिटोरियल पेज और विज्ञापन पेज। जिस तरह का पेज बनाना है वही tab खोलें।",
  },
  {
    target: "editor-tab-front",
    title: "फ्रंट पेज",
    body: "Front Page tab पहले पन्ने के लिए है। इसमें masthead के नीचे वाली खबरों का layout चुना जाता है।",
  },
  {
    target: "editor-layout-choice",
    title: "पेज का लेआउट चुनें",
    body: "जिस डिजाइन में पेज सेट करना है उसकी preview card देखें। बॉक्स की संख्या और arrangement पसंद आए तो उसी card के नीचे “चुनें →” पर click करें।",
  },
  {
    target: "editor-style-options",
    title: "चार style switches",
    body: "रंगीन headline, हल्की background tint, professional justification और inline bullet style यहीं से on/off होते हैं। Default अच्छे हैं, लेकिन जरूरत हो तो tick बदलें।",
  },
  {
    target: "editor-theme-palette",
    title: "Page theme colour",
    body: "नीचे palette cards से अखबार का पूरा colour mood चुनें। Selected palette headline accents, subheading background और tint में इस्तेमाल होती है।",
  },
  {
    target: "editor-style-next",
    title: "Style confirm करें",
    body: "Style/palette सही लगने पर “आगे बढ़ें” दबाएं। इसके बाद category और खबरें load करने वाला final step आएगा।",
  },
  {
    target: "editor-manual-boxes",
    title: "खुद की खबरें लिखनी हों तो",
    body: "बाईं तरफ page map में किसी numbered box पर click करें। उस box की headline, text, photo और caption खुद भर सकते हैं। खाली box auto-fill होंगे।",
  },
  {
    target: "editor-news-language",
    title: "Page language",
    body: "पहले भाषा चुनें। Hindi ready content के लिए हिंदी रखें; bilingual या English page के लिए live generation path use करें।",
  },
  {
    target: "editor-news-category",
    title: "Category चुनें",
    body: "Portal settings में category fixed हो तो note दिखेगा। अगर category grid दिख रही है तो जिस section की खबरें चाहिए वह category चुनें।",
  },
  {
    target: "editor-load-news",
    title: "खबरें लोड करें",
    body: "अब category/language check करें। Test के लिए “तैयार खबरें लोड करें” या final page के लिए “पन्ना बनाएं” दबाएं।",
  },
  {
    target: "editor-tab-inside",
    title: "Inside pages flow",
    body: "Inside Pages tab बाकी पन्नों के लिए है। यहाँ 6-column और 8-column layouts मिलते हैं। Tab खोलें, layout चुनें, style चुनें और खबरें load करें।",
  },
  {
    target: "editor-layout-choice",
    title: "Inside layout चुनें",
    body: "Inside page में भी वही rule है: जिस layout में page set करना है उसका preview देखें और नीचे “चुनें →” click करें।",
  },
  {
    target: "editor-style-options",
    title: "Inside page style",
    body: "Inside pages पर भी colour headings, tint, justification और inline bullet controls काम करते हैं। Default रख सकते हैं या अपने edition के हिसाब से बदलें।",
  },
  {
    target: "editor-load-news",
    title: "Inside page बनाएं",
    body: "Inside page की category/settings confirm करके ready या live news load करें। फिर page editor में preview और PDF download करें।",
  },
  {
    target: "editor-tab-editorial",
    title: "Editorial page flow",
    body: "Editorial Page tab में editorial layout चुनें, author rail/slots भरें या auto-fill रखें, फिर “एडिटोरियल पेज बनाएं” दबाएं।",
  },
  {
    target: "editor-editorial-layout-choice",
    title: "Editorial layout चुनें",
    body: "Editorial templates में slot count और page map देखें। जिस design में editorial सेट करना है उसके नीचे “चुनें →” दबाएं।",
  },
  {
    target: "editor-editorial-slots",
    title: "Editorial slots",
    body: "यहाँ हर editorial box में खुद लिख सकते हैं, author/photo जोड़ सकते हैं, या खाली slots को editorial feed से अपने-आप भरवा सकते हैं।",
  },
  {
    target: "editor-editorial-generate",
    title: "Editorial generate",
    body: "Slots और auto-fill source सही हों तो यह button editorial page बना देता है और editor canvas पर वापस ले आता है।",
  },
  {
    target: "editor-tab-advertisement",
    title: "Advertisement page flow",
    body: "Advertisement Page tab ads के लिए है। पहले JPG/PNG/PDF upload करें, फिर placement/header चुनें और बची जगह में articles भरें।",
  },
  {
    target: "editor-ad-upload",
    title: "Advertisement upload",
    body: "इस upload zone पर click या drag-drop करके ads जोड़ें। Multiple files भी चलेंगी, और blank border upload time पर trim हो जाती है।",
  },
  {
    target: "editor-ad-arrange",
    title: "Ads arrange करें",
    body: "Ads upload होने के बाद placement style और header चुनें, फिर “विज्ञापन व्यवस्थित करें” दबाकर page layout बनाएं।",
  },
  {
    target: "editor-page-preview",
    title: "पेज चेक करें",
    body: "PDF से पहले Preview खोलकर page देख लें। यही render PDF export में भी इस्तेमाल होता है, इसलिए गलती यहीं पकड़ में आ जाएगी।",
  },
  {
    target: "editor-download-pdf",
    title: "PDF डाउनलोड करें",
    body: "Layout और खबरें सही हों तो PDF Download दबाएं। Single-page portal flow में पैसा successful PDF export के बाद ही कटेगा।",
  },
  {
    target: "editor-regenerate-page",
    title: "बदलाव चाहिए?",
    body: "अगर page पसंद नहीं आया तो Regenerate Page से फिर वही wizard खोलें, नया layout या खबरें चुनें और दुबारा PDF बनाएं।",
  },
  {
    target: "editor-next-page",
    title: "अगला पेज",
    body: "एक पेज पूरा होने के बाद इसी से अगला पेज चुनकर वही flow दोहराएं।",
  },
];

export function startEditorTour() {
  window.dispatchEvent(new Event(EDITOR_TOUR_EVENT));
}

export function isEditorTourEnabled() {
  try {
    return window.localStorage.getItem(EDITOR_TOUR_ENABLED_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setEditorTourEnabled(on: boolean) {
  try {
    window.localStorage.setItem(EDITOR_TOUR_ENABLED_KEY, on ? "on" : "off");
    if (on) window.localStorage.removeItem(EDITOR_TOUR_SEEN_KEY);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent(EDITOR_TOUR_SETTING_EVENT, { detail: { on } }));
}

export function EditorTourControls() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(isEditorTourEnabled());
    const onSettingChange = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as { on?: boolean } : null;
      setOn(typeof detail?.on === "boolean" ? detail.on : isEditorTourEnabled());
    };
    window.addEventListener(EDITOR_TOUR_SETTING_EVENT, onSettingChange);
    return () => window.removeEventListener(EDITOR_TOUR_SETTING_EVENT, onSettingChange);
  }, []);

  return (
    <div className="editor-tour-controls" aria-label="Tutorial controls">
      <button
        type="button"
        className="editor-tour-help"
        onClick={() => startEditorTour()}
        aria-label="ट्यूटोरियल देखें"
        title="ट्यूटोरियल देखें"
      >
        ?
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="ट्यूटोरियल चालू या बंद करें"
        className={`editor-tour-switch${on ? " is-on" : ""}`}
        onClick={() => {
          const next = !on;
          setOn(next);
          setEditorTourEnabled(next);
          if (next) window.setTimeout(() => startEditorTour(), 120);
        }}
        title={on ? "ट्यूटोरियल चालू है" : "ट्यूटोरियल बंद है"}
      >
        <span />
      </button>
    </div>
  );
}

export function EditorGuidedTour({
  steps = EDITOR_TOUR_STEPS,
  autoStart = true,
}: {
  steps?: EditorTourStep[];
  autoStart?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardTop, setCardTop] = useState(0);
  const [placeBelow, setPlaceBelow] = useState(true);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [activeSteps, setActiveSteps] = useState<EditorTourStep[]>([]);
  const activeStepsRef = useRef<EditorTourStep[]>([]);
  const autoStartedSignatures = useRef<Set<string>>(new Set());
  const step = activeSteps[index];

  useEffect(() => {
    activeStepsRef.current = activeSteps;
  }, [activeSteps]);

  const getVisibleTarget = useCallback((target: string) => {
    const elements = Array.from(document.querySelectorAll(`[data-tour="${target}"]`));
    return elements.find((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    }) ?? null;
  }, []);

  const getContextualSteps = useCallback(() => {
    const pick = (targets: string[]) =>
      targets
        .map((target) => getStepByTarget(steps, target))
        .filter((item): item is EditorTourStep => Boolean(item && getVisibleTarget(item.target)));

    const wizardPanel = getVisibleTarget("editor-wizard-panel");
    if (!wizardPanel) {
      if (getVisibleTarget("editor-live-replace-popup")) {
        return pick([
          "editor-live-replace-popup",
          "editor-live-replace-headline",
          "editor-live-replace-body",
          "editor-live-replace-image",
          "editor-live-replace-done",
        ]);
      }

      const liveLayoutShell = getVisibleTarget("editor-live-layout-panel")?.closest(".publisher-focused-left");
      const liveLayoutTargets = liveLayoutShell?.classList.contains("sheet-collapsed")
        ? ["editor-live-layout-toggle"]
        : [
            "editor-live-layout-toggle",
            "editor-live-layout-panel",
            "editor-live-layout-boxes",
            "editor-live-layout-click-box",
            "editor-live-layout-selected",
            "editor-live-layout-load",
          ];
      const editorTargets = [
        "editor-generate-layout",
        ...liveLayoutTargets,
        "editor-page-preview",
        "editor-download-pdf",
        "editor-regenerate-page",
        "editor-next-page",
      ];
      return pick(editorTargets);
    }

    const panel = wizardPanel instanceof HTMLElement ? wizardPanel : null;
    const tab = panel?.classList.contains("tab-inside")
      ? "inside"
      : panel?.classList.contains("tab-editorial")
        ? "editorial"
        : panel?.classList.contains("tab-advertisement")
          ? "advertisement"
          : "front";

    const commonTabs = ["editor-section-tabs", `editor-tab-${tab}`];
    if (tab === "editorial") {
      return pick([
        ...commonTabs,
        "editor-editorial-layout-choice",
        "editor-editorial-slots",
        "editor-editorial-generate",
      ]);
    }

    if (tab === "advertisement") {
      return pick([
        ...commonTabs,
        "editor-ad-upload",
        "editor-ad-arrange",
        "editor-style-options",
      ]);
    }

    if (panel?.classList.contains("step-style")) {
      return pick([
        ...commonTabs,
        "editor-style-options",
        "editor-theme-palette",
        "editor-style-next",
      ]);
    }

    if (panel?.classList.contains("step-category")) {
      return pick([
        ...commonTabs,
        "editor-manual-boxes",
        "editor-news-language",
        "editor-news-category",
        "editor-load-news",
      ]);
    }

    return pick([
      ...commonTabs,
      "editor-layout-choice",
    ]);
  }, [getVisibleTarget, steps]);

  const collectSteps = useCallback(() => {
    const nextSteps = getContextualSteps();
    setActiveSteps(nextSteps);
    activeStepsRef.current = nextSteps;
    return nextSteps.length > 0;
  }, [getContextualSteps]);

  const begin = useCallback(() => {
    if (!collectSteps()) return;
    setIndex(getFirstActionableIndex(activeStepsRef.current));
    setOpen(true);
  }, [collectSteps]);

  const finish = useCallback((turnOff = false) => {
    setOpen(false);
    setRect(null);
    try {
      window.localStorage.setItem(EDITOR_TOUR_SEEN_KEY, "1");
    } catch {
      /* private mode */
    }
    if (turnOff) setEditorTourEnabled(false);
  }, []);

  const move = useCallback((direction: 1 | -1) => {
    const currentTarget = activeStepsRef.current[index]?.target;
    const nextSteps = getContextualSteps();
    if (nextSteps.length === 0) {
      finish();
      return;
    }

    setActiveSteps(nextSteps);
    activeStepsRef.current = nextSteps;
    const currentIndex = currentTarget
      ? nextSteps.findIndex((item) => item.target === currentTarget)
      : -1;
    const fallbackIndex = direction > 0
      ? getFirstActionableIndex(nextSteps)
      : nextSteps.length - 1;
    const nextIndex = currentIndex >= 0 ? currentIndex + direction : fallbackIndex;

    if (nextIndex < 0) {
      setIndex(0);
      return;
    }
    if (nextIndex >= nextSteps.length) {
      finish();
      return;
    }
    setIndex(nextIndex);
  }, [finish, getContextualSteps, index]);

  useEffect(() => {
    const onStart = () => begin();
    window.addEventListener(EDITOR_TOUR_EVENT, onStart);
    return () => window.removeEventListener(EDITOR_TOUR_EVENT, onStart);
  }, [begin]);

  useEffect(() => {
    if (!autoStart) return;
    let timer: number | null = null;

    const startCurrentScreen = () => {
      if (open || !isEditorTourEnabled()) return;
      let seen = true;
      try {
        seen = window.localStorage.getItem(EDITOR_TOUR_SEEN_KEY) === "1";
      } catch {
        seen = false;
      }
      if (seen) return;

      const nextSteps = getContextualSteps();
      const signature = nextSteps.map((item) => item.target).join("|");
      if (!signature || autoStartedSignatures.current.has(signature)) return;

      autoStartedSignatures.current.add(signature);
      setActiveSteps(nextSteps);
      activeStepsRef.current = nextSteps;
      setIndex(getFirstActionableIndex(nextSteps));
      setOpen(true);
    };

    const queueStart = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(startCurrentScreen, 900);
    };

    queueStart();
    const observer = typeof MutationObserver !== "undefined"
      ? new MutationObserver(queueStart)
      : null;
    observer?.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["class", "data-tour", "style"],
    });

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [autoStart, getContextualSteps, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [finish, move, open]);

  useEffect(() => {
    if (!open) return;

    const refreshContext = () => {
      const nextSteps = getContextualSteps();
      const currentSteps = activeStepsRef.current;
      const nextSignature = nextSteps.map((item) => item.target).join("|");
      const currentSignature = currentSteps.map((item) => item.target).join("|");

      if (nextSignature === currentSignature) return;
      activeStepsRef.current = nextSteps;
      setActiveSteps(nextSteps);

      if (nextSteps.length === 0) {
        setRect(null);
        return;
      }

      setIndex(getFirstActionableIndex(nextSteps));
    };

    refreshContext();
    const observer = typeof MutationObserver !== "undefined"
      ? new MutationObserver(refreshContext)
      : null;
    observer?.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["class", "data-tour", "style"],
    });
    const timer = window.setInterval(refreshContext, 250);

    return () => {
      observer?.disconnect();
      window.clearInterval(timer);
    };
  }, [getContextualSteps, open]);

  useEffect(() => {
    if (!open || !step) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest(`[data-tour="${step.target}"]`)
        : null;
      if (!target) return;
      window.setTimeout(() => {
        move(1);
      }, 260);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [move, open, step]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    let cancelled = false;

    const measure = () => {
      const el = getVisibleTarget(step.target);
      if (!el) {
        const nextSteps = getContextualSteps();
        if (nextSteps.length > 0) {
          activeStepsRef.current = nextSteps;
          setActiveSteps(nextSteps);
          setIndex(getFirstActionableIndex(nextSteps));
        } else {
          setRect(null);
        }
        return;
      }
      const r = el.getBoundingClientRect();
      if (cancelled) return;

      const next: Rect = {
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
      };
      setRect(next);

      const cardH = cardRef.current?.offsetHeight || 280;
      const vh = getViewportHeight();
      const spaceBelow = vh - (next.top + next.height);
      const spaceAbove = next.top;
      const below =
        step.placement === "bottom"
          ? true
          : step.placement === "top"
            ? false
            : spaceBelow >= cardH + CARD_GAP || spaceBelow >= spaceAbove;
      const desired = below
        ? next.top + next.height + CARD_GAP
        : next.top - CARD_GAP - cardH;

      setPlaceBelow(below);
      setCardTop(Math.min(Math.max(12, desired), Math.max(12, vh - cardH - 12)));
    };

    const el = getVisibleTarget(step.target);
    if (el) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "";
      el.scrollIntoView({ block: "center", behavior: "auto" });
      document.body.style.overflow = previousOverflow;
    }

    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [getContextualSteps, getVisibleTarget, open, step]);

  useLayoutEffect(() => {
    if (!open || !rect) return;
    const clampCard = () => {
      const cardH = cardRef.current?.offsetHeight || 280;
      const vh = getViewportHeight();
      setCardTop((current) => Math.min(Math.max(12, current), Math.max(12, vh - cardH - 12)));
    };

    clampCard();
    const observer = typeof ResizeObserver !== "undefined" && cardRef.current
      ? new ResizeObserver(clampCard)
      : null;
    if (cardRef.current) observer?.observe(cardRef.current);
    window.visualViewport?.addEventListener("resize", clampCard);
    window.addEventListener("resize", clampCard);
    return () => {
      observer?.disconnect();
      window.visualViewport?.removeEventListener("resize", clampCard);
      window.removeEventListener("resize", clampCard);
    };
  }, [open, rect]);

  if (!open || !step || !rect) return null;

  const total = activeSteps.length;
  const isLast = index === total - 1;
  const cardH = cardRef.current?.offsetHeight || 220;
  const targetCx = rect.left + rect.width / 2;
  const targetY = placeBelow ? rect.top + rect.height : rect.top;
  const cardY = placeBelow ? cardTop : cardTop + cardH;
  const arrowTop = Math.min(targetY, cardY);
  const arrowHeight = Math.max(placeBelow ? cardY - targetY : targetY - cardY, 1);
  const showArrow = arrowHeight >= 40;
  const dir = placeBelow ? -1 : 1;
  const sway = Math.min(64, Math.max(30, arrowHeight * 0.55));
  const startY = placeBelow ? arrowHeight : 0;
  const endY = placeBelow ? 0 : arrowHeight;
  const path = `M 60 ${startY} C ${60 - sway} ${startY + dir * arrowHeight * 0.35}, ${60 + sway * 0.6} ${endY - dir * arrowHeight * 0.3}, 60 ${endY}`;

  return (
    <div className="editor-tour-root" role="dialog" aria-modal="true" aria-label="एडिटर ट्यूटोरियल">
      <div
        className="editor-tour-spotlight"
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        onClick={() => finish()}
      />
      <div
        className="editor-tour-pulse"
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      />

      {showArrow ? (
        <svg
          className="editor-tour-arrow"
          style={{ top: arrowTop, left: targetCx - 60, width: 120, height: arrowHeight }}
          viewBox={`0 0 120 ${arrowHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path className="editor-tour-arrow-under" d={path} />
          <path className="editor-tour-arrow-line" d={path} />
          <path
            className="editor-tour-arrow-head"
            d={
              placeBelow
                ? `M 51 12 L 60 0 L 69 12`
                : `M 51 ${arrowHeight - 12} L 60 ${arrowHeight} L 69 ${arrowHeight - 12}`
            }
          />
        </svg>
      ) : null}

      <div
        ref={cardRef}
        className={`editor-tour-card ${placeBelow ? "is-below" : "is-above"}`}
        style={{
          top: cardTop,
          left: Math.min(Math.max(12, targetCx - 170), Math.max(12, window.innerWidth - 352)),
        }}
      >
        <div className="editor-tour-card-head">
          <span>GUIDED FLOW · {index + 1} / {total}</span>
          <button type="button" onClick={() => finish(true)}>छोड़ें</button>
        </div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="editor-tour-click-hint">हरा घेरा जिस control पर है, उसे सीधे click कर सकते हैं।</div>
        <div className="editor-tour-dots" aria-hidden="true">
          {activeSteps.map((item, dotIndex) => (
            <span key={item.target} className={dotIndex === index ? "is-on" : ""} />
          ))}
        </div>
        <div className="editor-tour-actions">
          {index > 0 ? (
            <button type="button" className="ghost" onClick={() => move(-1)}>
              पीछे
            </button>
          ) : null}
          <button
            type="button"
            className="primary"
            onClick={() => (isLast ? finish() : move(1))}
          >
            {isLast ? "समझ गया" : "आगे"}
          </button>
        </div>
      </div>
    </div>
  );
}
