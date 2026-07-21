import { TestBed } from '@angular/core/testing';

import { DocumentService } from './document';

describe('DocumentService', () => {
  let service: DocumentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DocumentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should store and return the current file', () => {
    const file = new File(['data'], 'test.pdf', { type: 'application/pdf' });
    service.setFile(file);
    expect(service.getFile()).toBe(file);
  });
});
