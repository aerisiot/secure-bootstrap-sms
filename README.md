# E2E solution demonstrating secure bootstrap using SMS
This NodeJs project demonstrates how to perform secure bootstrap of an application on a device utilizing SMS two-factor authentication. The OAUTH service uses the AerFrame service provided by Aeris to send SMS securely to the device. In addition, the project demonstrates how to use AerPort APIs to fetch current network status to find if device is in a packet session and make intelligent decisions in the cloud. For simplicity the project assumes that cellular is the only IP connectivity available.

The project uses Google IoT Core to demonstrate an end-to-end solution, and includes both server-side and client-side code for reference.

Please refer to [Wiki](https://github.com/aerisiot/secure-bootstrap-sms/wiki) for full details.

# How to run the device app
See [Test E2E solution](https://github.com/aerisiot/secure-bootstrap-sms/wiki/Test-E2E-solution)

# How to run the service app
See [Test E2E solution](https://github.com/aerisiot/secure-bootstrap-sms/wiki/Test-E2E-solution)
