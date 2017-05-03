export interface ValidatorContainer {
  [propertyName: string]: any[];
}

export interface FormGroupTemplateSubGroup {
  [propertyName: string]: FormGroupTemplate;
}

export type FormGroupType = 'FormGroup' | 'FormArray' | 'FormControl' | 'AnyOf' | '$ref'

export interface FormGroupDescriptorBase {
  controlType: FormGroupType;
}

export interface SubControlHolderBase {
  controls: FormGroupTemplateSubGroup | FormGroupTemplate[];
}

export interface FormGroupHasValidator {
  validators: ValidatorContainer;
}

export interface FormGroupTemplateGroupInfo extends FormGroupDescriptorBase, SubControlHolderBase, FormGroupHasValidator {
  controlType: 'FormGroup';
}

export interface AlternativeFormGroupTemplate  {
  discriminator: string;
  group: FormGroupTemplateSubGroup;
}

export interface AlternativeFormGroupTemplateItems {
   [discriminator: string]: AlternativeFormGroupTemplate
}

export interface AnyOfDiscriminatorInfo {
  name: string,
  schema: {[prerty: string]: any},
  discriminator: {[value: string]: number}
  discriminatorValues: string[];
}

export interface AnyOfTemplateGroupInfo extends FormGroupDescriptorBase, SubControlHolderBase {
  controlType: 'AnyOf';
  discriminator: AnyOfDiscriminatorInfo;
  discriminatorControl: FormGroupTemplate;
  distinctControls: AlternativeFormGroupTemplateItems;
}

export interface FormGroupTemplateArrayInfo extends FormGroupDescriptorBase, SubControlHolderBase, FormGroupHasValidator {
  controlType: 'FormArray';
  controls: FormGroupTemplate[];
}


export interface ControlTemplateInfo {
  value: any;
  disabled: boolean
}

export interface FormGroupTemplateControlInfo extends FormGroupDescriptorBase, FormGroupHasValidator {
  controlType: 'FormControl';
  value: ControlTemplateInfo;
}

export type FormGroupTemplate = FormGroupTemplateGroupInfo | FormGroupTemplateArrayInfo | FormGroupTemplateControlInfo| AnyOfTemplateGroupInfo;

export class FormGlobalOptions {
  addSubmit: String | boolean = 'auto'; // Add a submit button if layout does not have one?
  // for addSubmit= true = always; false = never; 'auto' = only if layout is undefined
  debug = false; // Show debugging output?
  fieldsRequired = false; // Are there any required fields in the form?
  framework = 'bootstrap-3'; // The framework to load
  widgets = {}; // Any custom widgets to load
  loadExternalAssets = false; // Load external css and JavaScript for framework?
  pristine = {errors: true, success: true};
  supressPropertyTitles = false;
  setSchemaDefaults = true;
  validateOnRender = false;
  formDefaults = { // Default options for form controls
    addable: true, // Allow adding items to an array or $ref point?
    orderable: true, // Allow reordering items within an array?
    removable: true, // Allow removing items from an array or $ref point?
    allowExponents: false, // Allow exponent entry in number fields?
    enableErrorState: true, // Apply 'has-error' class when field fails validation?
    // disableErrorState: false, // Don't apply 'has-error' class when field fails validation?
    enableSuccessState: true, // Apply 'has-success' class when field validates?
  // disableSuccessState: false, // Don't apply 'has-success' class when field validates?
    feedback: false, // Show inline feedback icons?
    notitle: false, // Hide title?
    readonly: false, // Set control as read only?
  }
}
