import { Component, Input, OnInit } from '@angular/core';
import { AbstractControl } from '@angular/forms';

import { JsonSchemaFormService } from '../library/json-schema-form.service';

@Component({
  selector: 'hidden-widget',
  template: `
    <input
      [disabled]="controlDisabled"
      [name]="controlName"
      [id]="'control' + layoutNode?._id"
      [type]="'hidden'"
      [value]="controlValue">`,
})
export class HiddenComponent implements OnInit {
  public formControl: AbstractControl;
  public controlName: string;
  public controlValue: any;
  public controlDisabled: boolean = false;
  public boundControl: boolean = false;
  @Input() formID: number;
  @Input() layoutNode: any;
  @Input() layoutIndex: number[];
  @Input() dataIndex: number[];

  constructor(
    public jsf: JsonSchemaFormService
  ) { }

  ngOnInit() {
    this.jsf.initializeControl(this);
  }
}
