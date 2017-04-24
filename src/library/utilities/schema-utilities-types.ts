export interface ValidatorContainer {
  [propertyName: string]: any[];
}

export interface FormGroupTemplateSubGroups {
  [propertyName: string]: FormGroupTemplate;
}

export type FormGroupType = 'FormGroup' | 'FormArray' | 'FormControl' | 'AnyOf' | '$ref'

export interface FormGroupDescriptorBase {
  controlType: FormGroupType;
}

export interface SubControlHolderBase {
  controls: FormGroupTemplateSubGroups | FormGroupTemplate[];
}

export interface FormGroupTemplateGroupInfo extends FormGroupDescriptorBase, SubControlHolderBase {
  controlType: 'FormGroup' | 'AnyOf';
  controls: FormGroupTemplateSubGroups;
  validators: ValidatorContainer;
}

export interface FormGroupTemplateArrayInfo extends FormGroupDescriptorBase, SubControlHolderBase {
  controlType: 'FormArray';
  controls: FormGroupTemplate[];
  validators: ValidatorContainer;
}

export interface ControlTemplateInfo {
  value: any;
  disabled: boolean
}

export interface FormGroupTemplateControlInfo extends FormGroupDescriptorBase {
  controlType: 'FormControl';
  value: ControlTemplateInfo;
  validators: ValidatorContainer;
}

export type FormGroupTemplate = FormGroupTemplateGroupInfo | FormGroupTemplateArrayInfo | FormGroupTemplateControlInfo;


