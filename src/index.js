const { Configuration, OpenAIApi } = require("openai")
const axios = require('axios')
const fs = require('fs');

const configuration = new Configuration({
  organization: "org-bsDfHoAbZB5X6GZpWwjvP8LY",
  apiKey: "API_KEY_OPENAI",
});

const openai = new OpenAIApi(configuration);

const apiKeyGoogleMaps = 'API_KEY_MAPS';

const config = {
  method: 'get',
  url: `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=-10.9172200,-37.6500000&radius=10000&type=restaurant&key=${apiKeyGoogleMaps}`,
  headers: {}
}

async function main() {
  const result = await axios(config)

  const arrayPlaceDetails = [];


  for (let i = result.data.results.length-1; i > 10; i--) {
    try {
      const resultPlaceDetails = await axios({
        method: 'get',
        url: `https://maps.googleapis.com/maps/api/place/details/json?place_id=${result.data.results[i].place_id}&key=${apiKeyGoogleMaps}`,
        headers: {}
      })
      const chatAI = await openai.createCompletion(
        {
          prompt: `
          Baseado nas informações de um possível cliente que vou passar no final, 
          crie uma mensagem de no máximo 200 palavras, para captar um possível cliente 
          para minha empresa de Marketing Digital que se chama MagicMarketing,
           a mensagem precisa ser passada de uma forma profissional, mas de uma 
           maneira que seja personalizada para cada tipo de cliente, não precisa 
           ser uma mensagem que pareça genérica, que o cliente saiba que podemos 
           fazer qualquer tipo de trabalho relacionado ao marketing.
           Informações sobre o cliente são:
           nome do estabelecimento: ${resultPlaceDetails.data.result.name}
           quantidade de avaliações no google maps(não escrever essa informação na mensagem): ${resultPlaceDetails.data.result.user_ratings_total ?? 0}
           avaliação total sendo 0 o mínimo e 5 o máximo(não escrever essa informação na mensagem): ${resultPlaceDetails.data.result.rating ?? 0}
           tipos de serviço(não escrever essa informação na mensagem): ${resultPlaceDetails.data.result.types.join(', ')}

           No final da mensagem, crie um nome comum entre brasileiros para se passar como um
           funcionário que trabalha na MagicMarketing. 
           A mensagem tem que ser clara e direta para o cliente, sem informações adicionais sobre o 
           funcionário fictício da MagicMarketing, sempre comece a mensagem com o nome do estabelecimento,
           e faça uma breve apresentação do funcionário fictício e o seu cargo.
          `,
          model: "text-davinci-003",
          max_tokens: 800,
          n: 1
        })

      const obj = {
        nome: resultPlaceDetails.data.result.name,
        endereco: resultPlaceDetails.data.result.formatted_address,
        telefone: resultPlaceDetails.data.result.formatted_phone_number ?? 'SEM NÚMERO',
        avaliacao: resultPlaceDetails.data.result.rating ?? 0,
        qtd_avaliacao: resultPlaceDetails.data.result.user_ratings_total ?? 0,
        mensagem: chatAI.data.choices[0].text
      }

      console.log(obj)

      arrayPlaceDetails.push(obj)
    } catch (err) {
      console.log(err)
    }

  }

  const fields = Object.keys(arrayPlaceDetails[0])

  const fileName = 'infoRestaurantsCity.csv'

  fs.writeFileSync(fileName, fields.join(',') + '\n')

  arrayPlaceDetails.forEach(obj => {
    const values = fields.map(field => {
      const value = obj[field].toString()

      return value.includes(',') ? `"${value}"` : value
    })
    fs.appendFileSync(fileName, values.join(',') + '\n');
  })

  console.log('Arquivo CSV criado')

}

main()