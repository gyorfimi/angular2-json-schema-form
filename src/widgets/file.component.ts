import { Component, Input, OnInit } from '@angular/core';
import { AbstractControl } from '@angular/forms';

import { JsonSchemaFormService } from '../library/json-schema-form.service';

@Component({
  selector: 'file-widget',
  template: ``,
})
export class FileComponent implements OnInit {
  public formControl: AbstractControl;
  public controlName: string;
  public controlValue: any;
  public controlDisabled: boolean = false;
  public boundControl: boolean = false;
  public options: any;
  @Input() formID: number;
  @Input() layoutNode: any;
  @Input() layoutIndex: number[];
  @Input() dataIndex: number[];

  constructor(
    public jsf: JsonSchemaFormService
  ) { }

  ngOnInit() {
    this.options = this.layoutNode.options;
    this.jsf.initializeControl(this);
  }

  public updateValue(event) {
    this.jsf.updateValue(this, event.target.value);
  }
}
