import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddMedicine } from './add-medicine';

describe('AddMedicine', () => {
  let component: AddMedicine;
  let fixture: ComponentFixture<AddMedicine>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddMedicine],
    }).compileComponents();

    fixture = TestBed.createComponent(AddMedicine);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
