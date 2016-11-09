var instant2fa = require('index');


describe('passport-instant2fa', function() {
    
  it('should export version', function() {
    expect(instant2fa.version).to.be.a('string');
  });
    
  it('should export Strategy', function() {
    expect(instant2fa.Strategy).to.be.a('function');
  });
  
});
