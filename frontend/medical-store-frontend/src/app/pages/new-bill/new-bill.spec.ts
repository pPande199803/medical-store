import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewBill } from './new-bill';

describe('NewBill', () => {
  let component: NewBill;
  let fixture: ComponentFixture<NewBill>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewBill],
    }).compileComponents();

    fixture = TestBed.createComponent(NewBill);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
