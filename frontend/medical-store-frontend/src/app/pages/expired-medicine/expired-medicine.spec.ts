import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpiredMedicine } from './expired-medicine';

describe('ExpiredMedicine', () => {
  let component: ExpiredMedicine;
  let fixture: ComponentFixture<ExpiredMedicine>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpiredMedicine],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpiredMedicine);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
