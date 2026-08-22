import type { ArticleData } from "@/types/editor";
import { createDefaultCaptionData } from "@/engines/CaptionStyling/CaptionStylingEngine";
import { defaultContainerStyles } from "@/engines/ContainerBackground/ContainerBackgroundEngine";
import { defaultUniversalTypographyControls } from "@/engines/UniversalTypography/UniversalTypographyEngine";
import {
  defaultInlineLabelStyle,
  defaultSubheadlineBannerStyle,
  getFactBoxTheme,
  getPullQuoteTheme,
} from "@/engines/EditorialStyling/EditorialStylingEngine";

export const prototypeArticle: ArticleData = {
  kicker: {
    enabled: false,
    text: "विशेष रिपोर्ट",
    style: {
      ...defaultInlineLabelStyle,
    },
  },
  strap: {
    enabled: false,
    text: "भोपाल",
    style: {
      ...defaultInlineLabelStyle,
      color: "#ffffff",
      backgroundColor: "#153e75",
    },
  },
  headline: "प्रदेश में मानसून की दस्तक, शहरों में जलभराव की तैयारी तेज",
  subheadline: "नगर निगम ने निचले इलाकों में पंप और राहत दल तैनात किए",
  caption: createDefaultCaptionData("चित्र: मुख्य सड़क पर सफाई अभियान के दौरान कर्मचारी।"),
  author: "संवाददाता",
  location: "भोपाल",
  agency: "",
  subheadlineBanner: {
    ...defaultSubheadlineBannerStyle,
  },
  factBox: {
    headline: "",
    bullets: [],
  },
  factBoxTheme: getFactBoxTheme("classic-gray"),
  pullQuote: {
    text: "",
  },
  pullQuoteTheme: getPullQuoteTheme("classic"),
  editorialPreset: "none",
  typography: {
    ...defaultUniversalTypographyControls,
  },
  containerStyles: {
    ...defaultContainerStyles,
  },
  body: [
    "मानसून को देखते हुए शहर में नालों की सफाई और जल निकासी की समीक्षा शुरू कर दी गई है।",
    "नगर निगम ने संवेदनशील वार्डों में अतिरिक्त पंप, सफाई दल और नियंत्रण कक्ष की व्यवस्था की है।",
    "अधिकारियों ने बताया कि बारिश के दौरान मुख्य सड़कों, बाजार क्षेत्रों और निचली बस्तियों पर विशेष नजर रखी जाएगी।",
    "स्थानीय पार्षदों से जलभराव की सूचना तुरंत साझा करने को कहा गया है ताकि राहत दल समय पर पहुंच सकें।",
    "स्वास्थ्य विभाग ने भी जलजनित रोगों से बचाव के लिए दवा छिड़काव और जागरूकता अभियान तेज करने की योजना बनाई है।",
    "नागरिकों से अपील की गई है कि वे नालियों में कचरा न डालें और आपात स्थिति में हेल्पलाइन नंबर पर संपर्क करें।",
  ].join(" "),
  columnCount: 3,
};
