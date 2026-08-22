import { strict as assert } from "node:assert";
import { loadBuiltInTemplates } from "./TemplateLibrary";
import {
  createTemplateManagerState,
  deleteTemplate,
  duplicateTemplate,
  exportTemplates,
  importTemplates,
  renameTemplate,
  saveTemplate,
  validateTemplates,
} from "./TemplateManager";
import { validateTemplate } from "./TemplateValidator";

const byType = (type: string) => loadBuiltInTemplates().find((template) => template.pageType === type)!;

const assertFrontPageTemplate = () => {
  const template = byType("front-page");
  const validation = validateTemplate(template);

  assert.equal(template.columns.count, 6);
  assert(template.preferredStorySlots.some((slot) => slot.priority === "lead"));
  assert(template.preferredImageSlots.some((slot) => slot.required));
  assert.equal(validation.valid, true);
};

const assertSportsTemplate = () => {
  const template = byType("sports");

  assert.equal(template.sectionName, "Sports");
  assert(template.preferredImageSlots.some((slot) => slot.name.includes("Action")));
  assert.equal(validateTemplate(template).valid, true);
};

const assertDistrictAndAdvertisementHeavyTemplates = () => {
  const district = byType("district");
  const adHeavy = loadBuiltInTemplates().find((template) => template.id === "template-ad-heavy")!;

  assert(district.preferredStorySlots.some((slot) => slot.name.includes("Local")));
  assert.equal(adHeavy.advertisementZones.length, 2);
  assert.equal(validateTemplate(adHeavy).valid, true);
};

const assertMagazineTemplate = () => {
  const template = byType("magazine");

  assert.equal(template.columns.count, 4);
  assert.equal(template.pageSize.width, 10);
  assert.equal(validateTemplate(template).valid, true);
};

const assertManagerLifecycle = () => {
  let state = createTemplateManagerState();
  const sourceCount = state.templates.length;

  state = duplicateTemplate(state, "template-sports", "template-sports-copy", "Sports Copy");
  assert.equal(state.templates.length, sourceCount + 1);
  state = renameTemplate(state, "template-sports-copy", "Renamed Sports Copy");
  assert.equal(state.templates.find((template) => template.id === "template-sports-copy")?.name, "Renamed Sports Copy");

  const exported = exportTemplates(state);
  const imported = importTemplates(exported);
  assert.equal(imported.validation.valid, true);
  assert.equal(imported.state.templates.length, state.templates.length);

  state = deleteTemplate(imported.state, "template-sports-copy");
  assert.equal(state.templates.length, sourceCount);
  assert.equal(validateTemplates(state).valid, true);

  const invalid = {
    ...state.templates[0],
    id: "invalid-template",
    margins: { top: 20, right: 0, bottom: 20, left: 0 },
    folio: { enabled: false, height: 0 },
  };
  const saved = saveTemplate(state, invalid);
  assert.equal(saved.validation.valid, false);
  assert.equal(saved.state, state);
};

assertFrontPageTemplate();
assertSportsTemplate();
assertDistrictAndAdvertisementHeavyTemplates();
assertMagazineTemplate();
assertManagerLifecycle();

console.log("Template library tests passed: 5");

