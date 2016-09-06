import hslMapGeneratorServer from '../../src/hsl-map-generator-server';

describe('hslMapGeneratorServer', () => {
  describe('Greet function', () => {
    beforeEach(() => {
      spy(hslMapGeneratorServer, 'greet');
      hslMapGeneratorServer.greet();
    });

    it('should have been run once', () => {
      expect(hslMapGeneratorServer.greet).to.have.been.calledOnce;
    });

    it('should have always returned hello', () => {
      expect(hslMapGeneratorServer.greet).to.have.always.returned('hello');
    });
  });
});
