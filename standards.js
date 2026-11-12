// Довідкові значення з ТУ та ГОСТ. Заповнюйте з ваших погоджених документів.
// null означає «значення ще не задано». Відсутні значення не замінюються нулями.
// Формули розрахунку будуть погоджені та додані окремо.
globalThis.FlangeStandards = {
  gasket: {
    name: 'ТМГ-ЛА-П1/А1',
    document: '',
    seatingPressureMPa: null,
    minimumPressureMPa: null,
    maximumPressureMPa: null,
    elasticModulusMPa: null,
    expansionMicroPerK: null,
    mediumCoefficients: {}
  },
  nuts: {
    document: '',
    sizes: {
      // Ключ — номінальний діаметр різьби в мм, наприклад '24'.
      // '24': { heightMm: ..., threadEngagementMm: ... }
    }
  },
  washers: {
    document: '',
    sizes: {
      // '24': { thicknessMm: ..., outerDiameterMm: ..., innerDiameterMm: ... }
    }
  }
};
