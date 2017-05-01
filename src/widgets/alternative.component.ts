import { Component, Input, OnInit } from '@angular/core';

import { JsonSchemaFormService } from '../library/json-schema-form.service';

@Component({
  selector: 'alternative-widget',
  template: `
    <fieldset
      [class]="options?.htmlClass"
      [class.expandable]="options?.expandable && !expanded"
      [class.expanded]="options?.expandable && expanded"
      [disabled]="options?.readonly">
      <legend *ngIf="options?.title && layoutNode?.type !== 'tab'"
        [class]="options?.labelHtmlClass"
        [class.sr-only]="options?.notitle"
        [innerHTML]="options?.title"
        (click)="expand()"></legend>
        <select-framework-widget
                [formID]="formID"
                [dataIndex]="dataIndex || []"
                [layoutIndex]="layoutIndex || []"
                [layoutNode]="layoutNode.discriminator"></select-framework-widget>

        <div *ngFor="let layoutKey of discriminatedLayout();">
            {{ layoutKey }}
            <root-widget *ngIf="expanded"
                         [formID]="formID"
                         [layout]="layoutNode.groups[layoutKey]?.items"
                         [dataIndex]="dataIndex"
                         [layoutIndex]="layoutIndex"
                         [isOrderable]="options?.orderable"></root-widget>
        </div>
        

    </fieldset>`,
  styles: [`
    .expandable > legend:before { content: '\\25B8'; padding-right: .3em; }
    .expanded > legend:before { content: '\\25BE'; padding-right: .2em; }
  `],
})
export class AlternativeComponent implements OnInit {
  public options: any;
  public expanded: boolean = true;
  @Input() formID: number;
  @Input() layoutNode: any;
  @Input() layoutIndex: number[];
  @Input() dataIndex: number[];

  constructor(
    public jsf: JsonSchemaFormService
  ) { }

  ngOnInit() {
    this.options = this.layoutNode.options;
    this.expanded = !this.options.expandable;
  }

  public expand() {
    if (this.options.expandable) { this.expanded = !this.expanded; }
  }

  public discriminatedLayout() {
    if (this.layoutNode.groups) {
        return Object.keys(this.layoutNode.groups);
    }
    return [];
  }
}
