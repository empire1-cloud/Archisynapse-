from setuptools import find_packages, setup

setup(
    name="archisynapse",
    version="1.0.0",
    description="Python SDK for the Archisynapse payment API",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    author="Archisynapse Team",
    packages=find_packages(),
    install_requires=["requests>=2.28.0"],
    python_requires=">=3.9",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Office/Business :: Financial",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
)
