import {
  AbstractControl, FormArray, FormControl, FormGroup, ValidatorFn
} from '@angular/forms';

import * as _ from 'lodash';

import {
  forEach, getControlValidators, hasOwn, hasValue, inArray, isArray, isEmpty,
  isObject, isDefined, isPrimitive, JsonPointer, JsonValidators, Pointer,
  toJavaScriptType, toSchemaType, resolveRecursiveReferences, SchemaPrimitiveType
} from './index';
import {
  FormGroupTemplate, FormGroupType, ValidatorContainer, FormGroupTemplateSubGroup,
  ControlTemplateInfo, FormGroupHasValidator,
  FormGlobalOptions, AnyOfDiscriminatorInfo, AlternativeFormGroupTemplateItems, FormGroupTemplateGroupInfo,
  AnyOfTemplateGroupInfo,
} from "./schema-utilities-types";


/**
 * FormGroup function library:
 *
 * preprocessSchemaAndGetTemplate:  Builds a FormGroupTemplate from schema
 *
 * buildFormGroup:          Builds an Angular 2 FormGroup from a FormGroupTemplate
 *
 * setRequiredFields:
 *
 * formatFormData:
 *
 * getControl:
 *
 * fixJsonFormOptions:
 *
 * ---- Under construction: ----
 * buildFormGroupTemplateFromLayout: Builds a FormGroupTemplate from a form layout
 */


/**
 * 'SchemaPreprocessor' class
 *
 * Builds a template for an Angular 2 FormGroup from a JSON Schema.
 *
 * TODO: add support for pattern properties
 * https://spacetelescope.github.io/understanding-json-schema/reference/object.html
 *
 * @param  {any} jsf -
 * @param  {any = null} setValues -
 * @param  {boolean = true} mapArrays -
 * @param  {string = ''} schemaPointer -
 * @param  {string = ''} dataPointer -
 * @param  {any = ''} templatePointer -
 * @return {any} -
 */

export type DataMapType = Map<string, Map<string, any>>;
export type ArrayMapType = Map<string, number>;
export type SchemaNodeInfoType = Map<string, any>;
export type TemplateRefLibraryType = { [templateName: string]: FormGroupTemplate };

export interface SchemaPreprocessorInfoHolder {
  readonly dataMap: DataMapType;
  readonly arrayMap: ArrayMapType;
  readonly schemaNodeInfo: SchemaNodeInfoType;
  readonly templateRefLibrary: TemplateRefLibraryType ;

}

export class BasicSchemaPreprocessor {

  readonly dataMap: DataMapType = new Map();
  readonly arrayMap: ArrayMapType = new Map();
  readonly schemaNodeInfo: SchemaNodeInfoType = new Map();
  readonly formGroupTemplate: FormGroupTemplate;
  readonly templateRefLibrary: TemplateRefLibraryType = {};

  constructor(private globalOptions: FormGlobalOptions, private schema: any, private setValues: any, mapArrays: boolean, schemaPointer: string, dataPointer: string, templatePointer: any, schemaPreprocessorInfoHolder: SchemaPreprocessorInfoHolder) {
    if (schemaPreprocessorInfoHolder) {
      this.dataMap = schemaPreprocessorInfoHolder.dataMap;
      this.arrayMap = schemaPreprocessorInfoHolder.arrayMap;
      this.schemaNodeInfo = schemaPreprocessorInfoHolder.schemaNodeInfo;
      this.templateRefLibrary = schemaPreprocessorInfoHolder.templateRefLibrary;
    }
    this.formGroupTemplate = this.preprocessSchemaAndGetTemplate(this.setValues, mapArrays, schemaPointer, dataPointer, templatePointer);
    console.log(this);
  }

  private preprocessSchemaAndGetTemplate(setValues: any = null, mapArrays: boolean, schemaPointer: string, dataPointer: string, templatePointer: any): FormGroupTemplate {
    const schema: any = (this.schemaNodeInfo.has("schema:"+schemaPointer)) ? this.schemaNodeInfo.get("schema:"+schemaPointer) : JsonPointer.get(this.schema, schemaPointer);
    let useValues: any = this.globalOptions.setSchemaDefaults ?
      mergeValues(JsonPointer.get(schema, '/default'), setValues) : setValues;

    const schemaType: string | string[] = JsonPointer.get(schema, '/type');

    let controlType: FormGroupType;
    if (hasOwn(schema, 'anyOf')) {
      controlType = 'AnyOf';
    }
    else if (schemaType === 'object' && hasOwn(schema, 'properties')) {
      controlType = 'FormGroup';
    } else if (schemaType === 'array' && hasOwn(schema, 'items')) {
      controlType = 'FormArray';
    } else if (!schemaType && hasOwn(schema, '$ref')) {
      controlType = '$ref';
    } else {
      controlType = 'FormControl';
    }
    if (dataPointer !== '' && !this.dataMap.has(dataPointer)) {
      this.dataMap.set(dataPointer, new Map);
      this.dataMap.get(dataPointer).set('schemaPointer', schemaPointer);
      this.dataMap.get(dataPointer).set('schemaType', schema.type);
      if (controlType) {
        this.dataMap.get(dataPointer).set('templatePointer', templatePointer);
        this.dataMap.get(dataPointer).set('templateType', controlType);
      }
      const genericDataPointer =
        JsonPointer.toGenericPointer(dataPointer, this.arrayMap);
      if (!this.dataMap.has(genericDataPointer)) {
        this.dataMap.set(genericDataPointer, new Map);
        this.dataMap.get(genericDataPointer).set('schemaPointer', schemaPointer);
        this.dataMap.get(genericDataPointer).set('schemaType', schema.type);
      }
    }
    let validators: ValidatorContainer = getControlValidators(schema);
    switch (controlType) {
      case 'FormGroup':
        let formGroupControls: FormGroupTemplateSubGroup = {};
        if (this.globalOptions.setSchemaDefaults) {
          useValues = mergeValues(
            JsonPointer.get(schema, '/properties/default'), useValues);
        }
        forEach(schema.properties, (item, key) => {
          if (key !== 'ui:order') {
            formGroupControls[key] = this.preprocessSchemaAndGetTemplate(
              JsonPointer.get(useValues, [<string>key]),
              mapArrays,
              schemaPointer + '/properties/' + key,
              dataPointer + '/' + key,
              templatePointer + '/controls/' + key
            );
          }
        });
        this.globalOptions.fieldsRequired =
          setRequiredFields(schema, formGroupControls);
        return {controlType: controlType, controls: formGroupControls, validators: validators};
      case 'FormArray':
        const minItems = schema.minItems || 0;
        const maxItems = schema.maxItems || 1000000;
        let formArrayControls: FormGroupTemplate[] = [];
        if (isArray(schema.items)) { // 'items' is an array = tuple items
          if (mapArrays && !this.arrayMap.get(dataPointer)) {
            this.arrayMap.set(dataPointer, schema.items.length);
          }
          formArrayControls = [];
          for (let i = 0, l = schema.items.length; i < l; i++) {
            if (i >= minItems &&
              !JsonPointer.has(this.templateRefLibrary, [dataPointer + '/' + i])
            ) {
              this.templateRefLibrary[dataPointer + '/' + i] =
                this.preprocessSchemaAndGetTemplate(null, mapArrays,
                  schemaPointer + '/items/' + i,
                  dataPointer + '/' + i,
                  templatePointer + '/controls/' + i
                );
            }
            if (i < maxItems) {
              const useValue = isArray(useValues) ? useValues[i] : useValues;
              formArrayControls.push(this.preprocessSchemaAndGetTemplate(
                useValue,
                false,
                schemaPointer + '/items/' + i,
                dataPointer + '/' + i,
                templatePointer + '/controls/' + i
              ));
            }
          }
          if (schema.items.length < maxItems &&
            hasOwn(schema, 'additionalItems') && isObject(schema.additionalItems)
          ) { // 'additionalItems' is an object = additional list items
            const l = Math.max(
              schema.items.length + 1,
              isArray(useValues) ? useValues.length : 0
            );
            for (let i = schema.items.length; i < l; i++) {
              const useValue = isArray(useValues) ? useValues[i] : useValues;
              formArrayControls.push(this.preprocessSchemaAndGetTemplate(
                useValues,
                false,
                schemaPointer + '/additionalItems',
                dataPointer + '/' + i,
                templatePointer + '/controls/' + i
              ));
              if (isArray(useValues)) {
                useValues = null;
              }
            }
            if (
              !JsonPointer.has(this, ['templateRefLibrary', dataPointer + '/-'])
            ) {
              this.templateRefLibrary[dataPointer + '/-'] =
                this.preprocessSchemaAndGetTemplate(
                  null, mapArrays,
                  schemaPointer + '/additionalItems',
                  dataPointer + '/-',
                  templatePointer + '/controls/-'
                );
            }
          }
        } else { // 'items' is an object = list items only (no tuple items)
          if (mapArrays && !this.arrayMap.get(dataPointer)) {
            this.arrayMap.set(dataPointer, 0);
          }
          if (
            !JsonPointer.has(this.templateRefLibrary, [dataPointer + '/-'])
          ) {
            this.templateRefLibrary[dataPointer + '/-'] =
              this.preprocessSchemaAndGetTemplate(null,
                mapArrays,
                schemaPointer + '/items',
                dataPointer + '/-',
                templatePointer + '/controls/-'
              );
          }
          if (this.globalOptions.setSchemaDefaults) {
            useValues = mergeValues(
              JsonPointer.get(schema, '/items/default'), useValues);
          }
          if (isArray(useValues) && useValues.length) {
            for (let i of Object.keys(useValues)) {
              formArrayControls.push(this.preprocessSchemaAndGetTemplate(
                useValues[i], false,
                schemaPointer + '/items',
                dataPointer + '/' + i,
                templatePointer + '/controls/' + i
              ));
            }
            useValues = null;
          }
        }
        let initialItemCount =
          Math.max(minItems, JsonPointer.has(schema, '/items/$ref') ? 0 : 1);
        if (formArrayControls.length < initialItemCount) {
          for (let i = formArrayControls.length, l = initialItemCount; i < l; i++) {
            formArrayControls.push(this.preprocessSchemaAndGetTemplate(useValues, false,
              schemaPointer + '/items',
              dataPointer + '/' + i,
              templatePointer + '/controls/' + i
            ));
          }
        }
        return {controlType: controlType, controls: formArrayControls, validators: validators};
      case 'FormControl':
        let value: ControlTemplateInfo = {
          value: isPrimitive(useValues) ? useValues : null,
          disabled: schema['disabled'] ||
          JsonPointer.get(schema, '/x-schema-form/disabled') || false
        };
        return {controlType: controlType, value: value, validators: validators};
      case "AnyOf":
        let discriminatorProperty = this.getDiscriminatorProperty(schema.anyOf, schemaPointer);
        if (!discriminatorProperty) return {controlType: 'FormControl', value: null, validators: {}};
        this.schemaNodeInfo.set("schema:" + schemaPointer + '/anyOf/' + discriminatorProperty.name, discriminatorProperty.schema);
        this.schemaNodeInfo.set("discriminator:" + schemaPointer+ '/anyOf', discriminatorProperty);
        let discriminatorControl = this.preprocessSchemaAndGetTemplate(JsonPointer.get(useValues, discriminatorProperty.name), mapArrays,
          schemaPointer + '/anyOf/' + discriminatorProperty.name,
          dataPointer + '/' + discriminatorProperty.name,
          templatePointer + '/discriminatorControl'
        );
        let controls: AlternativeFormGroupTemplateItems = {};
        forEach(discriminatorProperty.discriminatorValues, (discriminatorValue) => {
          let idx = discriminatorProperty.discriminator[discriminatorValue];
          let item = schema.anyOf[idx];
          if (item.type == 'object' && item.properties) {
            let group: FormGroupTemplateGroupInfo = <FormGroupTemplateGroupInfo> this.preprocessSchemaAndGetTemplate(useValues, mapArrays,
              schemaPointer + '/anyOf/' + idx,
              dataPointer+ '/' + discriminatorValue + '.' ,
              templatePointer + '/controls/' + discriminatorValue + '/group'
            );

            if (group.controlType = 'FormGroup') {
              JsonPointer.remove(group, '/controls/' + discriminatorProperty.name);
              controls[discriminatorValue] = {discriminator: discriminatorValue, group: group};
            }
          }
        });
        return {
          controlType: 'AnyOf',
          discriminator: discriminatorProperty,
          discriminatorControl: discriminatorControl,
          controls: controls
        };
      case '$ref':
        const schemaRef: string = JsonPointer.compile(schema.$ref);
        if (!hasOwn(this.templateRefLibrary, schemaRef)) {

          // Set to null first to prevent recursive reference from causing endless loop
          this.templateRefLibrary[schemaRef] = null;
          const newTemplate: any = this.preprocessSchemaAndGetTemplate(null, false, schemaRef, '', '');
          if (newTemplate) {
            this.templateRefLibrary[schemaRef] = newTemplate;
          } else {
            delete this.templateRefLibrary[schemaRef];
          }
        }
        return null;
      default:
        return null;
    }
  }

  private getDiscriminatorProperty(schemaArray: any, schemaPointer: string): AnyOfDiscriminatorInfo {
    if (!isArray(schemaArray)) {
      console.log(schemaPointer + ".AnyOf should be and array of schema");
      return null;
    }
    schemaArray = schemaArray.filter(item => item.properties);
    if (!schemaArray) {
      console.log(schemaPointer + ".AnyOf should be and array of object");
      return null;
    }

    let commonEnumProps: string[] = _.intersection.apply(_,
      <string[][]> (schemaArray.map(item => (item.properties) ? (Object.keys(item.properties)
            .filter(keyitem => hasOwn(item.properties[keyitem], "enum"))
        ) : []).filter(item => item)
      ));


    // get common properties of common items;
    let commons = commonEnumProps.reduce((result, prop) => {
      let intersectionArgs = schemaArray.map(item => Object.keys(item.properties[prop]).filter(item => item != "enum").map(pname => {
        return {prop: pname, value: item.properties[prop][pname]}
      })).concat([_.isEqual]);
      result[prop] = Object.assign({}, _.intersectionWith.apply(_, intersectionArgs).reduce((coll, pv) => {
        coll[pv.prop] = pv.value;
        return coll;
      }, {}));

      let enumList = schemaArray.map(item => item.properties[prop]["enum"]).filter(item => isArray(item)).reduce((coll, item) => coll.concat(item), []);
      if (enumList) {
        result[prop]["enum"] = enumList;
      }
      return result;
    }, {});

    let discriminatorProps = commonEnumProps.filter((item) => commons[item].enum && _.uniq(commons[item].enum).length == commons[item].enum.length);
    if (!discriminatorProps || discriminatorProps.length != 1) {
      console.log(schemaPointer + ".AnyOf has not exactly one discrimator property (common enum property): properties:" , discriminatorProps);
      return null;
    }

    let discriminatorProp = discriminatorProps[0];
    let discriminator:  {[value: string]: number} =
    schemaArray
      .filter(item => item.properties && item.properties[discriminatorProp] && item.properties[discriminatorProp].enum && item.properties[discriminatorProp].enum.forEach)
      .reduce((result, item, idx) => {item.properties[discriminatorProp].enum.forEach( enumItem => result[enumItem] = idx); return result;}, {} );

    return { name: discriminatorProp, schema:commons[discriminatorProp], discriminator: discriminator, discriminatorValues: Object.keys(discriminator) };
  }


}

export class SchemaPreprocessor extends BasicSchemaPreprocessor {

  constructor(globalOptions: FormGlobalOptions, schema: any, setValues: any) {
    super(globalOptions, schema, setValues, true, '', '', '', null);
  }
}



export class ChangeableFormGroupItems {
  [discrimantorValue: string]: FormGroup;
}

export class ChangeableFormGroup extends FormGroup {

  public constructor(public discriminatorControl: FormControl,  public discriminatorName: string, public discriminatorValues: string[], public groups:ChangeableFormGroupItems) {
    super({});
    this.selectGroup(discriminatorControl.value)
  }

  public selectGroup(value: string) {
    Object.keys(this.controls).forEach((ctrl) => this.removeControl(ctrl));
    this.addControl(this.discriminatorName, this.discriminatorControl);
    if (hasOwn(this.groups,value)) {
      Object.keys(this.groups[value].controls).forEach((ctrl) => this.addControl(ctrl, this.groups[value].controls[ctrl]));
    }
  }

}

/**
 * 'buildFormGroup' function
 *
 * @param {any} template -
 * @return {AbstractControl}
*/
export function buildFormGroup(template: FormGroupTemplate): AbstractControl {
  let validatorFns: ValidatorFn[] = [];
  let validatorFn: ValidatorFn = null;
  if (hasOwn(template, 'validators')) {
    let validatedTemplate = <FormGroupHasValidator> template;
    forEach(validatedTemplate.validators, (parameters, validator) => {
      if (typeof JsonValidators[validator] === 'function') {
        validatorFns.push(JsonValidators[validator].apply(null, parameters));
      }
    });
    if (validatorFns.length &&
      (template.controlType == 'FormGroup' || template.controlType == 'FormArray')
    ) {
      validatorFn = validatorFns.length > 1 ?
        JsonValidators.compose(validatorFns) : validatorFns[0];
    }
  }
  if (hasOwn(template, 'controlType')) {
    switch (template.controlType) {
      case 'FormGroup':
        let groupControls: { [key: string]: AbstractControl } = {};
        forEach(template.controls, (control, key) => {
          let newControl: AbstractControl = buildFormGroup(control);
          if (newControl) { groupControls[key] = newControl; }
        });
        return new FormGroup(groupControls, validatorFn);
      case 'AnyOf':
        let discriminatorControl = <FormControl> buildFormGroup(template.discriminatorControl);
        let groupItems: ChangeableFormGroupItems = {};
        forEach(template.discriminator.discriminatorValues, (discriminatorValue) => {
              let ctrls = (<AnyOfTemplateGroupInfo> template).controls[discriminatorValue];
              groupItems[discriminatorValue] = <FormGroup> buildFormGroup(ctrls.group);
          }
        );
        return new ChangeableFormGroup(discriminatorControl, template.discriminator.name, template.discriminator.discriminatorValues, groupItems);
      case 'FormArray':
        return new FormArray(_.filter(_.map(template.controls,
          controls => buildFormGroup(controls)
        )), validatorFn);
      case 'FormControl':
        return new FormControl(template.value, validatorFns);
    }
  }
  return null;
}

/**
 * 'mergeValues' function
 *
 * @param  {any[]} ...valuesToMerge - Multiple values to merge
 * @return {any} - Merged values
 */
export function mergeValues(...valuesToMerge) {
  let mergedValues: any = null;
  for (let index = 0, length = arguments.length; index < length; index++) {
    const currentValue = arguments[index];
    if (!isEmpty(currentValue)) {
      if (typeof currentValue === 'object' &&
        (isEmpty(mergedValues) || typeof mergedValues !== 'object')
      ) {
        if (isArray(currentValue)) {
          mergedValues = [].concat(currentValue);
        } else if (isObject(currentValue)) {
          mergedValues = Object.assign({}, currentValue);
        }
      } else if (typeof currentValue !== 'object') {
        mergedValues = currentValue;
      } else if (isObject(mergedValues) && isObject(currentValue)) {
        Object.assign(mergedValues, currentValue);
      } else if (isObject(mergedValues) && isArray(currentValue)) {
        let newValues = [];
        for (let value of currentValue) {
          newValues.push(mergeValues(mergedValues, value));
        }
        mergedValues = newValues;
      } else if (isArray(mergedValues) && isObject(currentValue)) {
        let newValues = [];
        for (let value of mergedValues) {
          newValues.push(mergeValues(value, currentValue));
        }
        mergedValues = newValues;
      } else if (isArray(mergedValues) && isArray(currentValue)) {
        let newValues = [];
        const l = Math.max(mergedValues.length, currentValue.length);
        for (let i = 0; i < l; i++) {
          if (i < mergedValues.length && i < currentValue.length) {
            newValues.push(mergeValues(mergedValues[i], currentValue[i]));
          } else if (i < mergedValues.length) {
            newValues.push(mergedValues[i]);
          } else if (i < currentValue.length) {
            newValues.push(currentValue[i]);
          }
        }
        mergedValues = newValues;
      }
    }
  }
  return mergedValues;
}

/**
 * 'setRequiredFields' function
 *
 * @param {schema} schema - JSON Schema
 * @param {object} formControlTemplate - Form Control Template object
 * @return {boolean} - true if any fields have been set to required, false if not
 */
export function setRequiredFields(schema: any, formControlTemplate: any): boolean {
  let fieldsRequired = false;
  if (hasOwn(schema, 'required') && !isEmpty(schema.required)) {
    fieldsRequired = true;
    let requiredArray = isArray(schema.required) ? schema.required : [schema.required];
    requiredArray = forEach(requiredArray,
      key => JsonPointer.set(formControlTemplate, '/' + key + '/validators/required', [])
    );
  }
  return fieldsRequired;

  // TODO: Add support for patternProperties
  // https://spacetelescope.github.io/understanding-json-schema/reference/object.html
  //   #pattern-properties
}

/**
 * 'formatFormData' function
 *
 * @param {any} formData - Angular 2 FormGroup data object
 * @param  {Map<string, any>} dataMap -
 * @param  {Map<string, string>} recursiveRefMap -
 * @param  {Map<string, number>} arrayMap -
 * @param {boolean = false} fixErrors - if TRUE, tries to fix data
 * @return {any} - formatted data object
 */
export function formatFormData(
  formData: any, dataMap: Map<string, any>, recursiveRefMap: Map<string, string>,
  arrayMap: Map<string, number>, fixErrors: boolean = false
): any {
// return formData;
  let formattedData = {};
  JsonPointer.forEachDeep(formData, (value, dataPointer) => {
    if (typeof value !== 'object') {
      let genericPointer: string =
        JsonPointer.has(dataMap, [dataPointer, 'schemaType']) ?
          dataPointer :
          resolveRecursiveReferences(dataPointer, recursiveRefMap, arrayMap);
      if (JsonPointer.has(dataMap, [genericPointer, 'schemaType'])) {
        const schemaType: SchemaPrimitiveType | SchemaPrimitiveType[] =
          dataMap.get(genericPointer).get('schemaType');
        if (schemaType === 'null') {
          JsonPointer.set(formattedData, dataPointer, null);
        } else if ( hasValue(value) &&
          inArray(schemaType, ['string', 'integer', 'number', 'boolean'])
        ) {
          const newValue = fixErrors ?
            toSchemaType(value, schemaType) :
            toJavaScriptType(value, schemaType);
          if (isDefined(newValue)) {
            JsonPointer.set(formattedData, dataPointer, newValue);
          }
        }
      } else {
        console.error('formatFormData error: Schema type not found ' +
          'for form value at "' + genericPointer + '".');
        console.error(formData);
        console.error(dataMap);
        console.error(recursiveRefMap);
        console.error(arrayMap);
      }
    }
  });
  return formattedData;
}

/**
 * 'getControl' function
 *
 * Uses a JSON Pointer for a data object to retrieve a control from
 * an Angular 2 formGroup or formGroup template. (Note: though a formGroup
 * template is much simpler, its basic structure is idential to a formGroup).
 *
 * If the optional third parameter 'returnGroup' is set to TRUE, the group
 * containing the control is returned, rather than the control itself.
 *
 * @param {FormGroup} formGroup - Angular 2 FormGroup to get value from
 * @param {Pointer} dataPointer - JSON Pointer (string or array)
 * @param {boolean = false} returnGroup - If true, return group containing control
 * @return {group} - Located value (or true or false, if returnError = true)
 */
export function getControl(
  formGroup: AbstractControl | FormGroupTemplate, dataPointer: Pointer, returnGroup: boolean = false
): any {
  const dataPointerArray: string[] = JsonPointer.parse(dataPointer);
  let subGroup: any = formGroup;
  if (dataPointerArray !== null) {
    let l = dataPointerArray.length - (returnGroup ? 1 : 0);
    for (let i = 0; i < l; ++i) {
      let key = dataPointerArray[i];
      if (subGroup instanceof ChangeableFormGroup) {
        console.log(subGroup, key)
        if (key == 'discriminator') {
          subGroup = (<ChangeableFormGroup> subGroup).discriminatorControl;
          i++; // skip the name
          continue;
        }
        if (key == 'groups') {
          subGroup = (<ChangeableFormGroup> subGroup).groups;
          continue;
        }
      }
      if (subGroup.hasOwnProperty('controls')) {
        subGroup = subGroup.controls;
      }
      if (isArray(subGroup) && (key === '-')) {
        subGroup = subGroup[subGroup.length - 1];
      } else if (subGroup.hasOwnProperty(key)) {
        subGroup = subGroup[key];
      } else {
        console.error('getControl error: Unable to find "' + key +
          '" item in FormGroup.');
        console.error(dataPointer);
        console.error(formGroup);
        return;
      }
    }
    return subGroup;
  }
  console.error('getControl error: Invalid JSON Pointer: ' + dataPointer);
}

/**
 * 'fixJsonFormOptions' function
 *
 * Rename JSON Form-style 'options' lists to
 * Angular Schema Form-style 'titleMap' lists.
 *
 * @param  {any} formObject
 * @return {any}
 */
export function fixJsonFormOptions(layout: any): any {
  if (isObject(layout) || isArray(layout)) {
    forEach(layout, (value, key) => {
      if (isObject(value) && hasOwn(value, 'options') && isObject(value.options)) {
        value.titleMap = value.options;
        delete value.options;
      }
    }, 'top-down');
  }
  return layout;
}
