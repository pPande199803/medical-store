import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AllMedicine } from './all-medicine';

describe('AllMedicine', () => {
  let component: AllMedicine;
  let fixture: ComponentFixture<AllMedicine>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AllMedicine],
    }).compileComponents();

    fixture = TestBed.createComponent(AllMedicine);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
