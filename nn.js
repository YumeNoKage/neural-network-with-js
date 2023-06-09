/* path to the data sets */
const trainingDataPath = "./mnist/mnist_train.csv";
const testDataPath = "./mnist/mnist_test.csv";


const mMap = math.map; // to be used to pass each element of a matrix to a function
const rand = math.random;
const transp = math.transpose;
const mat = math.matrix;
const e = math.evaluate;
const sub = math.subtract;
const sqr = math.square;
const sum = math.sum;

let myNN

class NeuralNetwork {
    constructor(inputNodes, hiddenNodes, outputNodes, learningRate, wih, who) {
        this.inputNodes = inputNodes;
        this.hiddenNodes = hiddenNodes;
        this.outputNodes = outputNodes;
        this.learningRate = learningRate;
    
        this.wih = wih || sub(mat(rand([hiddenNodes, inputNodes])), 0.5);
        this.who = who || sub(mat(rand([outputNodes, hiddenNodes])), 0.5);
    
        this.act = (matrix) => mMap(matrix, (x) => 1 / (1 + Math.exp(-x)));
    }
    
    cache = { loss: [] };

    static normalizeData = (data) => {
        return data.map((e) => (e / 255) * 0.99 + 0.01);
    }

    forward = (input) => { 
        const wih = this.wih
        const who = this.who
        const act = this.act

        input = transp(mat([input]))

        const h_in = e('wih * input', { wih, input })
        const h_out = act(h_in)

        const o_in = e('who * h_out', { who, h_out })
        const actual = act(o_in)

        this.cache.input = input
        this.cache.h_out = h_out
        this.cache.actual = actual
        
        return actual
    };

    backward = (target) => {
        const who = this.who;
        const input = this.cache.input;
        const h_out = this.cache.h_out;
        const actual = this.cache.actual;
    
        target = transp(mat([target]));
    
        // calculate the gradient of the error function (E) w.r.t the activation function (A)
        const dEdA = sub(target, actual);
    
        // calculate the gradient of the activation function (A) w.r.t the weighted sums (Z) of the output layer
        const o_dAdZ = e("actual .* (1 - actual)", {
            actual,
        });
    
        // calculate the error gradient of the loss function w.r.t the weights of the hidden-to-output layer
        const dwho = e("(dEdA .* o_dAdZ) * h_out'", {
            dEdA,
            o_dAdZ,
            h_out,
        });
    
        // calculate the weighted error for the hidden layer
        const h_err = e("who' * (dEdA .* o_dAdZ)", {
            who,
            dEdA,
            o_dAdZ,
        });
    
        // calculate the gradient of the activation function (A) w.r.t the weighted sums (Z) of the hidden layer
        const h_dAdZ = e("h_out .* (1 - h_out)", {
            h_out,
        });
    
        // calculate the error gradient of the loss function w.r.t the weights of the input-to-hidden layer
        const dwih = e("(h_err .* h_dAdZ) * input'", {
            h_err,
            h_dAdZ,
            input,
        });
    
        this.cache.dwih = dwih;
        this.cache.dwho = dwho;
        this.cache.loss.push(sum(sqr(dEdA)));
    };

    update = () => {
        const wih = this.wih;
        const who = this.who;
        const dwih = this.cache.dwih;
        const dwho = this.cache.dwho;
        const r = this.learningRate;
    
        this.wih = e("wih + (r .* dwih)", { wih, r, dwih });
        this.who = e("who + (r .* dwho)", { who, r, dwho });
    };

    predict = (input) => {
        return this.forward(input);
    };
    
    train = (input, target) => {
        this.forward(input);
        this.backward(target);
        this.update();
    };
}

function prepareData(rawData, target, labels) {
    rawData = rawData.split("\n"); // create an array where each element correspondents to one line in the CSV file
    rawData.pop(); // remove the last element which is empty because it refers to a last blank line in the CSV file

    rawData.forEach((current) => {
        let sample = current.split(",").map((x) => +x); // create an array where each element has a gray color value

        labels.push(sample[0]); // extract the first element of the sample which is (mis)used as the label
        sample.shift(); // remove the first element
        
        sample = NeuralNetwork.normalizeData(sample);
        
        target.push(sample);
    });
}

/* these constants will be filled during data loading and preparation */
const trainingData = [];
const trainingLabels = [];
const testData = [];
const testLabels = [];
const weightsFilename = "weights.json";
const savedWeightsPath = `./dist/${weightsFilename}`;

/* neural network's hyper parameters */
const inputNodes = 784;
const hiddenNodes = 100;
const outputNodes = 10;
const learningRate = 0.2;
const threshold = 0.5;
let iter = 0;
const iterations = 5;
const savedWeights = {};

/* states after how many trained samples a log message should appear */
const printSteps = 1000;


function formatPrediction(prediction) {
    const flattened = prediction.toArray().map((x) => x[0]);
    return flattened.indexOf(Math.max(...flattened));
}

function createDownloadLink() {
    const wih = myNN.wih.toArray();
    const who = myNN.who.toArray();
    const weights = { wih, who };
    download.innerHTML = `<a download="${savedWeightsPath}" id="downloadLink" href="data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(weights)
    )}">Download model weights</a>`;
}

function train() {
    trainButton.disabled = true;
    testButton.disabled = true;
    loadWeightsButton.disabled = true;

    const status = document.getElementById("status");
    if (iter < iterations) {
        iter++;
        
        trainingData.forEach((current, index) => {
            setTimeout(() => {
                /* create one-hot encoding of the label */
                const label = trainingLabels[index];
                const oneHotLabel = Array(10).fill(0);
                oneHotLabel[label] = 0.99;

                myNN.train(current, oneHotLabel);

                /* check if the defined interval for showing a message on the training progress is reached */
                if (index > 0 && !((index + 1) % printSteps)) {
                    status.innerHTML += `finished  ${index + 1}  samples ... <br>`;
                }
        
                /* check if the end of the training iteration is reached */
                if (index === trainingData.length - 1) {
                    status.innerHTML += `Loss:  ${ sum(myNN.cache.loss) / trainingData.length }<br><br>`;
                    
                    myNN.cache.loss = [];
        
                    test("", true); // true to signal "test" that it is called from within training
                }
            }, 0);
        });
    }
}

function test(_, inTraining = false) {
    const status = document.getElementById("status");
    let correctPredicts = 0;
    
    testData.forEach((current, index) => {

        setTimeout(() => {
            const actual = testLabels[index];
            
            const predict = formatPrediction(myNN.predict(current));
            predict === actual ? correctPredicts++ : null;

            /* check if training is complete */
            /* if test is called from within training and the training is not complete yet, continue training */
            if (index >= testData.length - 1 && inTraining) {
                train();
            }

            /* check if the defined interval for showing a message on the testing progress is reached */
            if (index > 0 && !((index + 1) % printSteps)) {
                status.innerHTML += " finished " + (index + 1) + " samples ...<br>";
            }

            /* check if testing is complete */
            if (index >= testData.length - 1) {
                status.innerHTML += "Accuracy: " + Math.round((correctPredicts / testData.length) * 100) + " %<br><br>";

                /* check if training is complete */
                if (iter + 1 > iterations) {
                    createDownloadLink();
                    // enableAllButtons();
                    status.innerHTML += "Finished training.<br><br>";
                    
                    iter = 0;
                } else if (inTraining) {
                // if test is called from within training and the training is not complete yet, continue training
                    train();
                // } else {
                //     enableAllButtons();
                }
            }
        }, 0)
    })
}

function loadWeights() {
    const status = document.getElementById("status");
    myNN.wih = savedWeights.wih;
    myNN.who = savedWeights.who;
    status.innerHTML += "Weights successfully loaded.";
}

async function loadData(path, type) {
    try {
        const result = await fetch(path, {
            mode: "no-cors",
        });
    
        switch (type) {
            case "CSV":
                return await result.text();
                break;
            case "JSON":
                return await result.json();
                break;
            default:
                return false;
        }
    } catch {
        return false;
    }
}

function predict() {
    /* resize the canvas to the training data image size  */
    const prediction = document.getElementById("prediction");
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(canvas, 0, 0, 150, 150, 0, 0, 28, 28);

     /* convert the canvas image */
    const img = tempCtx.getImageData(0, 0, 28, 28);

     /* remove the alpha channel and convert to grayscale */
    let sample = [];
    for (let i = 0, j = 0; i < img.data.length; i += 4, j++) {
        sample[j] = (img.data[i + 0] + img.data[i + 1] + img.data[i + 2]) / 3;
    }

    img.data = NeuralNetwork.normalizeData(img.data);


    const predict = formatPrediction(myNN.predict(sample));
    prediction.innerHTML = predict;
}

window.onload = async () => {
    const status = document.getElementById("status");
    /* Instantiate an entity from the NeuralNetwork class */
    myNN = new NeuralNetwork(inputNodes, hiddenNodes, outputNodes, learningRate);

    status.innerHTML = "Loading the data sets. Please wait ...<br>";

    /* get all the data set files and do the preparations */

    const trainCSV = await loadData(trainingDataPath, "CSV");

    if (trainCSV) {
        prepareData(trainCSV, trainingData, trainingLabels);
        status.innerHTML += "Training data successfully loaded...<br>";
    }

    const testCSV = await loadData(testDataPath, "CSV");

    if (testCSV) {
        prepareData(testCSV, testData, testLabels);
        status.innerHTML += "Test data successfully loaded...<br>";
    }

    if (!trainCSV || !testCSV) {
        status.innerHTML += "Error loading train/test data set. Please check your file path! If you run this project locally, it needs to be on a local server.";
        return;
    }

    trainButton.disabled = false;
    testButton.disabled = false;

    const weightsJSON = await loadData(savedWeightsPath, "JSON");

    /* if there is a saved JSON file with pretrained weights existing, save the content in the weightsJSON constant */
    if (weightsJSON) {
        savedWeights.wih = weightsJSON.wih;
        savedWeights.who = weightsJSON.who;

        status.innerHTML = "Weights successfully loaded.";
        loadWeightsButton.disabled = false;
    }

    status.innerHTML += "Ready.<br><br>";
};