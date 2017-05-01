import * as _ from 'lodash';

import {
  getType, hasValue, inArray, isString, isFunction, isObject, isArray
} from './validator.functions';
import { forEach, hasOwn, mergeFilteredObject } from './utility.functions';
import { JsonPointer, Pointer } from './jsonpointer.functions';
import { JsonValidators } from './json.validators';
import {ValidatorContainer} from "./schema-utilities-types";
import enumerate = Reflect.enumerate;


/**
 * JSON Schema function library:
 *
 * buildSchemaFromLayout:   TODO: Write this function
 *
 * buildSchemaFromData:
 *
 * getFromSchema:
 *
 * getInputType:
 *
 * isInputRequired:
 *
 * updateInputOptions:
 *
 * getControlValidators:
 */

/**
 * 'buildSchemaFromLayout' function
 *
 * Build a JSON Schema from a JSON Form layout
 *
 * @param {any[]} layout - The JSON Form layout
 * @return {JSON Schema} - The new JSON Schema
 */
export function buildSchemaFromLayout(layout: any[]): any {
  return;
  // let newSchema: any = { };
  // const walkLayout = (layoutItems: any[], callback: Function): any[] => {
  //   let returnArray: any[] = [];
  //   for (let layoutItem of layoutItems) {
  //     const returnItem: any = callback(layoutItem);
  //     if (returnItem) { returnArray = returnArray.concat(callback(layoutItem)); }
  //     if (layoutItem.items) {
  //       returnArray = returnArray.concat(walkLayout(layoutItem.items, callback));
  //     }
  //   }
  //   return returnArray;
  // };
  // walkLayout(layout, layoutItem => {
  //   let itemKey: string;
  //   if (typeof layoutItem === 'string') {
  //     itemKey = layoutItem;
  //   } else if (layoutItem.key) {
  //     itemKey = layoutItem.key;
  //   }
  //   if (!itemKey) { return; }
  //   //
  // });
}

/**
 * 'buildSchemaFromData' function
 *
 * Build a JSON Schema from a data object
 *
 * @param {any} data - The data object
 * @return {JSON Schema} - The new JSON Schema
 */
export function buildSchemaFromData(
  data: any, requireAllFields: boolean = false, isRoot: boolean = true
): any {
  let newSchema: any = { };
  if (isRoot) { newSchema.$schema = 'http://json-schema.org/draft-04/schema#'; }
  const getFieldType = (value: any): string => {
    let fieldType = getType(value, 'strict');
    if (fieldType === 'integer') { return 'number'; }
    if (fieldType === 'null') { return 'string'; }
    return fieldType;
  };
  newSchema.type = getFieldType(data);
  if (newSchema.type === 'object') {
    newSchema.properties = {};
    if (requireAllFields) { newSchema.required = []; }
    for (let key of Object.keys(data)) {
      newSchema.properties[key] = buildSchemaFromData(data[key], requireAllFields, false);
      if (requireAllFields) { newSchema.required.push(key); }
    }
  } else if (newSchema.type === 'array') {
    let itemTypes: string[] = data.map(getFieldType).reduce(
      (types, type) => types.concat(types.indexOf(type) === -1 ? type : [])
    , []);
    const buildSubSchemaFromData = (value) => buildSchemaFromData(value, requireAllFields, false);
    if (itemTypes.length === 1) {
      newSchema.items = data.map(buildSubSchemaFromData).reduce(
        (combined, item) => Object.assign(combined, item)
      , { });
    } else {
      newSchema.items = data.map(buildSubSchemaFromData);
    }
    if (requireAllFields) { newSchema.minItems = 1; }
  }
  return newSchema;
}

/**
 * 'getFromSchema' function
 *
 * Uses a JSON Pointer for a data object to retrieve a sub-schema from
 * a JSON Schema which describes that data object
 *
 * @param {JSON Schema} schema - The schema to get the sub-schema from
 * @param {Pointer} dataPointer - JSON Pointer (string or array)
 * @param {boolean = false} returnContainer - Return containing object instead?
 * @return {schema} - The located sub-schema
 */
export function getFromSchema(
  schema: any, dataPointer: Pointer, returnContainer: boolean = false
): any {
  const dataPointerArray: any[] = JsonPointer.parse(dataPointer);
  let subSchema = schema;
  if (dataPointerArray === null) {
    console.error('getFromSchema error: Invalid JSON Pointer: ' + dataPointer);
    return null;
  }
  const l = returnContainer ? dataPointerArray.length - 1 : dataPointerArray.length;
  for (let i = 0; i < l; ++i) {
    const parentSchema = subSchema;
    const key = dataPointerArray[i];
    let subSchemaArray = false;
    let subSchemaObject = false;
    if (typeof subSchema !== 'object') {
      console.error('getFromSchema error: Unable to find "' + key +
        '" key in schema.');
      console.error(schema);
      console.error(dataPointer);
      return null;
    }
    if (subSchema['type'] === 'array' && subSchema.hasOwnProperty('items') &&
      (!isNaN(key) || key === '-')
    ) {
      subSchema = subSchema['items'];
      subSchemaArray = true;
    }
    if (subSchema['type'] === 'object' && subSchema.hasOwnProperty('properties')) {
      subSchema = subSchema['properties'];
      subSchemaObject = true;
    }
    if (!subSchemaArray || !subSchemaObject) {
      if (subSchemaArray && key === '-') {
        subSchema = (parentSchema.hasOwnProperty('additionalItems')) ?
          parentSchema.additionalItems : { };
      } else if (typeof subSchema === 'object' && subSchema.hasOwnProperty(key)) {
        subSchema = subSchema[key];
      } else {
        console.error('getFromSchema error: Unable to find "' + key +
          '" item in schema.');
        console.error(schema);
        console.error(dataPointer);
        return;
      }
    }
  }
  return subSchema;
}

function _arraymerger(base, addendum) {
  return _.mergeWith(base, addendum,
    (objValue, srcValue) => {
      if (_.isArray(objValue) && _.isArray(srcValue)) {
        return objValue.concat(srcValue);
      }
    });
}

/**
 * Simplifies schema:
 *  - removes as much $ref as possible
 *  - transforms allOf to merge of properties
 *
 */
export function processSchemaReferences(schema: any) {

  class RefInfo {
    refSchema: any;
    isRecursive = false;
    isExtended = false;
    referred = new Set<string>();

    constructor(public id: string, public base: any, public pointer, public isOuterSchema = false) {
      this.refSchema = JsonPointer.get(base, pointer);
    }
  }

  const refInfos = new Map<String, RefInfo>();
  const referrers = new Map<String, RefInfo>();

  const schemaProcessor = (base: any, schema: any, uri: string) => {

    JsonPointer.forEachDeep(schema, (value, pointer) => {
      if (hasOwn(value, '$ref') && isString(value['$ref'])) {
        const referredPointer = JsonPointer.compile(value['$ref']);
        const theReference = uri + '/' + referredPointer;
        if (!refInfos.has(theReference)) {
          // TODO: load if required, and process it as well
          const refInfo = new RefInfo(theReference, base, referredPointer);
          refInfos.set(theReference, refInfo);
        }
        const refInfo = refInfos.get(theReference);
        const referrer = uri + '/' + pointer;
        referrers.set(referrer, value);
        refInfo.referred.add(referrer);
      }
    });

    let extendRefs = (ref: RefInfo, underExtension: Set<string>) => {
      if (ref.isExtended) {
        return;
      }
      if (underExtension.has(ref.id)) {
        ref.isRecursive = true;
        return;
      }
      try {
        underExtension.add(ref.id);
        JsonPointer.forEachDeep(ref.refSchema, (value, pointer) => {
          if (hasOwn(value, '$ref') && isString(value['$ref'])) {
            const referredPointer = JsonPointer.compile(value['$ref']);
            const theReference = refInfos.get(uri + '/' + referredPointer);
            extendRefs(theReference, underExtension);
          }

        });
        if (!ref.isRecursive) {
          ref.referred.forEach((refd) => {
            const value = referrers.get(refd);
            delete value['$ref'];
            _arraymerger(value, ref.refSchema);
          });
        }
      } finally {
        ref.isExtended = true;
        underExtension.delete(ref.id);
      }

    };

    const baseExtensions = new Set<string>();
    refInfos.forEach((ref) => extendRefs(ref, baseExtensions));

  };

  schemaProcessor(schema, schema, 'base:');

  // Debug purposes only
  const subSchemas = new Map<string, any>();


  const schemaEnumerator = (schema, basepath) => {
    if (typeof schema != 'object') {
      console.log(`Schema at ${basepath} is not object.`, schema);
      return schema;
    }
    if (hasOwn(schema, 'anyOf')) {
      schema.anyOf = schema.anyOf.map( subschema => schemaEnumerator(subschema, basepath + 'anyOf/'));
      return schema;
    }
    if (hasOwn(schema, 'allOf')) {
      if (!isArray(schema.allOf)) {
        console.log(`Schema at ${basepath} has allOf, but it is not an array`);
        return schema;
      }
      const allOf = <any[]> schema.allOf;
      schema = allOf.reduce((container, subschema) => _arraymerger(container, subschema), {});
      schema.type = 'object';
      return schemaEnumerator(schema, basepath);
    }
    if (hasOwn(schema, 'type')) {
      // TODO: GYM: array type?
      if (typeof schema.type != "string") {
        /// ??? allOf ???
        console.log(`Schema at ${basepath} has type, but only string type is supported`);
        return schema;
      }
      if (schema.type === 'object') {
        if (hasOwn(schema, 'properties')) {
          forEach(schema.properties, (prop, name) => {
            schema.properties[name] = schemaEnumerator(prop, basepath + '/' + name)
          })
        }
        if (hasOwn(schema, 'patternProperties')) {
          forEach(schema.patternProperties, (prop, name) => {
            schema.patternProperties[name] = schemaEnumerator(prop, basepath + '//' + name + '/')
          })
        }
      } else if (schema.type === 'array') {
        if (hasOwn(schema, 'items')) {
          if (typeof schema.items === 'object') {
            if (isArray(schema.items)) {
              forEach(schema.items, (prop, idx) => {
                schema.items[idx] = schemaEnumerator(prop, basepath + '/' + idx)
              })
            } else {
              schema.items = schemaEnumerator(schema.items, basepath + '/-');
            }
          }
        }
      }

      subSchemas.set(basepath, schema);
      return schema;

    } else {
      if (hasOwn(schema, 'properties') || hasOwn(schema, 'patternProperties')) {
        schema.type = 'object';
        return schemaEnumerator(schema, basepath);
      }
      if (hasOwn(schema, 'items')) {
        schema.type = 'array';
        return schemaEnumerator(schema, basepath);
      }
      subSchemas.set(basepath, schema);
      return schema;
    }
  };

  schema = schemaEnumerator(schema, '#');

  //console.log(subSchemas);

  return schema;

}

/**
 * 'resolveRecursiveReferences' function
 *
 * Checks a JSON Pointer against a map of recursive references and returns
 * a JSON Pointer to the shallowest equivalent location in the same object.
 *
 * Using this functions enables an object to be constructed with unlimited
 * recursion, while maintaing a fixed set of metadata, such as field data types.
 * The object can grow as large as it wants, and deeply recursed nodes can
 * just refer to the metadata for their shallow equivalents, instead of having
 * to add additional redundant metadata for each recursively added node.
 *
 * Example:
 *
 * pointer:         '/stuff/and/more/and/more/and/more/and/more/stuff'
 * recursiveRefMap: [['/stuff/and/more/and/more', '/stuff/and/more/']]
 * returned:        '/stuff/and/more/stuff'
 *
 * @param  {Pointer} pointer -
 * @param  {Map<string, string>} recursiveRefMap -
 * @param  {Map<string, number>} arrayMap - optional
 * @return {string} -
 */
export function resolveRecursiveReferences(
  pointer: Pointer, recursiveRefMap: Map<string, string>,
  arrayMap: Map<string, number> = new Map<string, number>()
): string {
  let genericPointer =
    JsonPointer.toGenericPointer(JsonPointer.compile(pointer), arrayMap);
  let possibleReferences = true;
  let previousPointerValues: Pointer[] = [];
  const catchCircularLinks = (newPointer) => {
    if (previousPointerValues.indexOf(newPointer) !== -1) {
      console.error('resolveRecursiveReferences error: ' +
        'recursive reference map contains circular links');
      console.error(recursiveRefMap);
      return;
    }
    previousPointerValues.push(genericPointer);
    return newPointer;
  };
  while (possibleReferences) {
    possibleReferences = false;
    recursiveRefMap.forEach((toPointer, fromPointer) => {
      if (JsonPointer.isSubPointer(toPointer, fromPointer)) {
        while (JsonPointer.isSubPointer(fromPointer, genericPointer)) {
          genericPointer = catchCircularLinks(JsonPointer.toGenericPointer(
            toPointer + genericPointer.slice(fromPointer.length), arrayMap
          ));
          possibleReferences = true;
        }
      }
    });
  }
  return genericPointer;
}

/**
 * 'getInputType' function
 *
 * @param {any} schema
 * @return {string}
 */
export function getInputType(schema: any, layoutNode: any = null): string {
  // x-schema-form = Angular Schema Form compatibility
  // widget & component = React Jsonschema Form compatibility
  let controlType = JsonPointer.getFirst([
    [schema, '/x-schema-form/type'],
    [schema, '/x-schema-form/widget/component'],
    [schema, '/x-schema-form/widget'],
    [schema, '/widget/component'],
    [schema, '/widget']
  ]);
  if (isString(controlType)) { return checkInlineType(controlType, schema, layoutNode); }
  let schemaType = schema.type;
  if (schemaType) {
    if (isArray(schemaType)) { // If multiple types listed, use most inclusive type
      if (inArray('object', schemaType) && hasOwn(schema, 'properties')) {
        schemaType = 'object';
      } else if (inArray('array', schemaType) && hasOwn(schema, 'items')) {
        schemaType = 'array';
      } else if (inArray('string', schemaType)) {
        schemaType = 'string';
      } else if (inArray('number', schemaType)) {
        schemaType = 'number';
      } else if (inArray('integer', schemaType)) {
        schemaType = 'integer';
      } else if (inArray('boolean', schemaType)) {
        schemaType = 'boolean';
      } else {
        schemaType = 'null';
      }
    }
    if (schemaType === 'boolean') { return 'checkbox'; }
    if (schemaType === 'object') {
      if (hasOwn(schema, 'properties')) { return 'fieldset'; }
      if (hasOwn(schema, '$ref') ||
      JsonPointer.has(schema, '/additionalProperties/$ref')) { return '$ref'; }
      return null; // return 'textarea'; (?)
    }
    if (schemaType === 'array') {
      let itemsObject = JsonPointer.getFirst([
        [schema, '/items'],
        [schema, '/additionalItems']
      ]);
      if (!itemsObject) { return null; }
      if (hasOwn(itemsObject, 'enum')) {
        return checkInlineType('checkboxes', schema, layoutNode);
      } else {
        return 'array';
      }
    }
    if (schemaType === 'null') { return 'hidden'; }
    if (hasOwn(schema, 'enum')) { return 'select'; }
    if (schemaType === 'number' || schemaType === 'integer') {
      if (hasOwn(schema, 'maximum') && hasOwn(schema, 'minimum') &&
      (schemaType === 'integer' || hasOwn(schema, 'multipleOf'))) { return 'range'; }
      return schemaType;
    }
    if (schemaType === 'string') {
      if (hasOwn(schema, 'format')) {
        if (schema.format === 'color') { return 'color'; }
        if (schema.format === 'date') { return 'date'; }
        if (schema.format === 'date-time') { return 'datetime-local'; }
        if (schema.format === 'email') { return 'email'; }
        if (schema.format === 'uri') { return 'url'; }
      }
      return 'text';
    }
  }
  if (hasOwn(schema, 'anyOf')) { console.log("anyOf"); return 'alternative'; }
  if (hasOwn(schema, '$ref')) { return '$ref'; }
  return 'text';
}

/**
 * 'checkInlineType' function
 *
 * @param {string} controlType -
 * @param {JSON Schema} schema -
 * @return {string}
 */
export function checkInlineType(
  controlType: string, schema: any, layoutNode: any = null
): string {
  if (!isString(controlType) || (
    controlType.slice(0, 8) !== 'checkbox' && controlType.slice(0, 5) !== 'radio'
  )) {
    return controlType;
  }
  if (
    JsonPointer.getFirst([
      [layoutNode, '/inline'],
      [layoutNode, '/options/inline'],
      [schema, '/inline'],
      [schema, '/x-schema-form/inline'],
      [schema, '/x-schema-form/options/inline'],
      [schema, '/x-schema-form/widget/inline'],
      [schema, '/x-schema-form/widget/component/inline'],
      [schema, '/x-schema-form/widget/component/options/inline'],
      [schema, '/widget/inline'],
      [schema, '/widget/component/inline'],
      [schema, '/widget/component/options/inline'],
    ]) === true
  ) {
    return controlType.slice(0, 5) === 'radio' ?
      'radios-inline' : 'checkboxes-inline';
  } else {
    return controlType;
  }
}

/**
 * 'isInputRequired' function
 *
 * Checks a JSON Schema to see if an item is required
 *
 * @param {schema} schema - the schema to check
 * @param {string} key - the key of the item to check
 * @return {boolean} - true if the item is required, false if not
 */
export function isInputRequired(schema: any, pointer: string): boolean {
  if (!isObject(schema)) {
    console.error('isInputRequired error: Input schema must be an object.');
    return false;
  }
  let listPointerArray: string[] = JsonPointer.parse(pointer);
  if (isArray(listPointerArray) && listPointerArray.length) {
    let keyName: string = listPointerArray.pop();
    let requiredList: string[];
    if (listPointerArray.length) {
      if (listPointerArray[listPointerArray.length - 1] === '-') {
        requiredList = JsonPointer.get(schema,
          listPointerArray.slice(-1).concat(['items', 'required']));
      } else {
        requiredList = JsonPointer.get(schema, listPointerArray.concat('required'));
      }
    } else {
      requiredList = schema['required'];
    }
    if (isArray(requiredList)) { return requiredList.indexOf(keyName) !== -1; }
  }
  return false;
};

/**
 * 'updateInputOptions' function
 *
 * @param {any} layoutNode
 * @param {any} schema
 * @return {void}
 */
export function updateInputOptions(layoutNode: any, schema: any, jsf: any) {
  if (!isObject(layoutNode)) { return; }
  const templatePointer = JsonPointer.get(jsf,
    ['dataMap', layoutNode.dataPointer, 'templatePointer']);

  // If a validator is available for a layout option,
  // and not already set in the formGroup template, set it
  Object.keys(layoutNode).forEach(option => {
    if (option !== 'type' && isFunction(JsonValidators[option]) && (
      !hasOwn(schema, option) || ( schema[option] !== layoutNode[option] &&
        !(option.slice(0, 3) === 'min' && schema[option] < layoutNode[option]) &&
        !(option.slice(0, 3) === 'max' && schema[option] > layoutNode[option])
      )
    )) {
      const validatorPointer = templatePointer + '/validators/' + option;
      jsf.formGroupTemplate = JsonPointer.set(
        jsf.formGroupTemplate, validatorPointer, [layoutNode[option]]
      );
    }
  });

  // Set all option values in layoutNode.options
  let newOptions: any = { };
  const fixUiKeys = (key) => key.slice(0, 3) === 'ui:' ? key.slice(3) : key;
  mergeFilteredObject(newOptions, jsf.globalOptions.formDefaults,
    [], fixUiKeys);
  if (JsonPointer.has(schema, '/items/enum')) { newOptions.enum = schema.items.enum; }
  if (JsonPointer.has(schema, '/items/titleMap')) { newOptions.enum = schema.items.titleMap; }
  mergeFilteredObject(newOptions, JsonPointer.get(schema, '/ui:widget/options'),
    [], fixUiKeys);
  mergeFilteredObject(newOptions, JsonPointer.get(schema, '/ui:widget'),
    [], fixUiKeys);
  mergeFilteredObject(newOptions, schema, ['properties', 'items', 'required',  'type', 'x-schema-form', '$ref', 'definitions'], fixUiKeys);
  mergeFilteredObject(newOptions, JsonPointer.get(schema, '/x-schema-form/options'),
    [], fixUiKeys);
  mergeFilteredObject(newOptions, JsonPointer.get(schema, '/x-schema-form'),
    ['items', 'options'], fixUiKeys);
  mergeFilteredObject(newOptions, layoutNode, ['arrayItem', 'dataPointer',
    'dataType', 'items', 'layoutPointer', 'listItems', 'name', 'options',
    'tupleItems', 'type', 'widget', '_id', '$ref'], fixUiKeys);
  mergeFilteredObject(newOptions, layoutNode.options, [], fixUiKeys);
  layoutNode.options = newOptions;

  // If schema type is integer, enforce by setting multipleOf = 1
  if (schema.type === 'integer' && !hasValue(layoutNode.options.multipleOf)) {
    layoutNode.options.multipleOf = 1;
  }

  // Copy any typeahead word lists to options.typeahead.source
  if (JsonPointer.has(newOptions, '/autocomplete/source')) {
    newOptions.typeahead = newOptions.autocomplete;
  } else if (JsonPointer.has(newOptions, '/tagsinput/source')) {
    newOptions.typeahead = newOptions.tagsinput;
  } else if (JsonPointer.has(newOptions, '/tagsinput/typeahead/source')) {
    newOptions.typeahead = newOptions.tagsinput.typeahead;
  }

  // If field value is set in layoutNode, and no input data, update template value
  if (templatePointer && schema.type !== 'array' && schema.type !== 'object') {
    let layoutNodeValue: any = JsonPointer.getFirst([
      [ jsf.defaultValues, layoutNode.dataPointer ],
      [ layoutNode, '/value' ],
      [ layoutNode, '/default' ]
    ]);
    let templateValue: any = JsonPointer.get(
      jsf.formGroupTemplate, templatePointer + '/value/value'
    );
    if (hasValue(layoutNodeValue) && layoutNodeValue !== templateValue) {
      jsf.formGroupTemplate = JsonPointer.set(
        jsf.formGroupTemplate, templatePointer + '/value/value', layoutNodeValue
      );
    }
    delete layoutNode.value;
    delete layoutNode.default;
  }
}

/**
 * 'getControlValidators' function
 *
 * @param {schema} schema
 * @return {validators}
 */
export function getControlValidators(schema: any): ValidatorContainer {
  if (!isObject(schema)) { return null; }
  let validators: ValidatorContainer = {};
  if (hasOwn(schema, 'type')) {
    switch (schema.type) {
      case 'string':
        forEach(['pattern', 'format', 'minLength', 'maxLength'], (prop) => {
          if (hasOwn(schema, prop)) { validators[prop] = [schema[prop]]; }
        });
      break;
      case 'number': case 'integer':
        forEach(['Minimum', 'Maximum'], (Limit) => {
          let eLimit = 'exclusive' + Limit;
          let limit = Limit.toLowerCase();
          if (hasOwn(schema, limit)) {
            let exclusive = hasOwn(schema, eLimit) && schema[eLimit] === true;
            validators[limit] = [schema[limit], exclusive];
          }
        });
        forEach(['multipleOf', 'type'], (prop) => {
          if (hasOwn(schema, prop)) { validators[prop] = [schema[prop]]; }
        });
      break;
      case 'object':
        forEach(['minProperties', 'maxProperties', 'dependencies'], (prop) => {
          if (hasOwn(schema, prop)) { validators[prop] = [schema[prop]]; }
        });
      break;
      case 'array':
        forEach(['minItems', 'maxItems', 'uniqueItems'], (prop) => {
          if (hasOwn(schema, prop)) { validators[prop] = [schema[prop]]; }
        });
      break;
    }
  }
  if (hasOwn(schema, 'enum')) { validators['enum'] = [schema['enum']]; }
  return validators;
}




