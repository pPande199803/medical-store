import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderMedicine } from './order-medicine';

describe('OrderMedicine', () => {
  let component: OrderMedicine;
  let fixture: ComponentFixture<OrderMedicine>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderMedicine],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderMedicine);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
